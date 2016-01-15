/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <windows.h>
#include <ras.h>
#include <wininet.h>

#include "mozilla/ArrayUtils.h"
#include "mozilla/Attributes.h"
#include "nsISystemProxySettings.h"
#include "nsIServiceManager.h"
#include "mozilla/ModuleUtils.h"
#include "nsPrintfCString.h"
#include "nsNetCID.h"
#include "nsISupportsPrimitives.h"
#include "nsIURI.h"

class nsWindowsSystemProxySettings final : public nsISystemProxySettings
{
public:
    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSISYSTEMPROXYSETTINGS

    nsWindowsSystemProxySettings() {};
    nsresult Init();

private:
    ~nsWindowsSystemProxySettings() {};

    bool MatchOverride(const nsACString& aHost);
    bool PatternMatch(const nsACString& aHost, const nsACString& aOverride);
};

NS_IMPL_ISUPPORTS(nsWindowsSystemProxySettings, nsISystemProxySettings)

NS_IMETHODIMP
nsWindowsSystemProxySettings::GetMainThreadOnly(bool *aMainThreadOnly)
{
  *aMainThreadOnly = false;
  return NS_OK;
}


nsresult
nsWindowsSystemProxySettings::Init()
{
    return NS_OK;
}

static void SetProxyResult(const char* aType, const nsACString& aHostPort,
                           nsACString& aResult)
{
    aResult.AssignASCII(aType);
    aResult.Append(' ');
    aResult.Append(aHostPort);
}

static void SetProxyResultPrivafox(const char* aType, const nsACString& aHostPort,
                           nsACString& aResult)
{
    aResult.AssignASCII(aType);
    aResult.Append(aHostPort);
}
static void SetProxyResultDirect(nsACString& aResult)
{
    // For whatever reason, a proxy is not to be used.
    aResult.AssignASCII("DIRECT");
}

static nsresult ReadInternetOption(uint32_t aOption, uint32_t& aFlags,
                                   nsAString& aValue)
{
    DWORD connFlags = 0;
    WCHAR connName[RAS_MaxEntryName + 1];
    MOZ_SEH_TRY {
        InternetGetConnectedStateExW(&connFlags, connName,
                                     mozilla::ArrayLength(connName), 0);
    } MOZ_SEH_EXCEPT(EXCEPTION_EXECUTE_HANDLER) {
        return NS_ERROR_FAILURE;
    }

    INTERNET_PER_CONN_OPTIONW options[2];
    options[0].dwOption = INTERNET_PER_CONN_FLAGS_UI;
    options[1].dwOption = aOption;

    INTERNET_PER_CONN_OPTION_LISTW list;
    list.dwSize = sizeof(INTERNET_PER_CONN_OPTION_LISTW);
    list.pszConnection = connFlags & INTERNET_CONNECTION_MODEM ?
                         connName : nullptr;
    list.dwOptionCount = mozilla::ArrayLength(options);
    list.dwOptionError = 0;
    list.pOptions = options;

    unsigned long size = sizeof(INTERNET_PER_CONN_OPTION_LISTW);
    if (!InternetQueryOptionW(nullptr, INTERNET_OPTION_PER_CONNECTION_OPTION,
                              &list, &size)) {
        if (GetLastError() != ERROR_INVALID_PARAMETER) {
            return NS_ERROR_FAILURE;
        }
        options[0].dwOption = INTERNET_PER_CONN_FLAGS;
        size = sizeof(INTERNET_PER_CONN_OPTION_LISTW);
        MOZ_SEH_TRY {
            if (!InternetQueryOptionW(nullptr,
                                      INTERNET_OPTION_PER_CONNECTION_OPTION,
                                      &list, &size)) {
                return NS_ERROR_FAILURE;
            }
        } MOZ_SEH_EXCEPT(EXCEPTION_EXECUTE_HANDLER) {
            return NS_ERROR_FAILURE;
        }
    }

    aFlags = options[0].Value.dwValue;
    aValue.Assign(options[1].Value.pszValue);
    GlobalFree(options[1].Value.pszValue);

    return NS_OK;
}

bool
nsWindowsSystemProxySettings::MatchOverride(const nsACString& aHost)
{
    nsresult rv;
    uint32_t flags = 0;
    nsAutoString buf;

    rv = ReadInternetOption(INTERNET_PER_CONN_PROXY_BYPASS, flags, buf);
    if (NS_FAILED(rv))
        return false;

    NS_ConvertUTF16toUTF8 cbuf(buf);

    nsAutoCString host(aHost);
    int32_t start = 0;
    int32_t end = cbuf.Length();

    // Windows formats its proxy override list in the form:
    // server;server;server where 'server' is a server name pattern or IP
    // address, or "<local>". "<local>" must be translated to
    // "localhost;127.0.0.1".
    // In a server name pattern, a '*' character matches any substring and
    // all other characters must match themselves; the whole pattern must match
    // the whole hostname.
    while (true) {
        int32_t delimiter = cbuf.FindCharInSet(" ;", start);
        if (delimiter == -1)
            delimiter = end;

        if (delimiter != start) {
            const nsAutoCString override(Substring(cbuf, start,
                                                   delimiter - start));
            if (override.EqualsLiteral("<local>")) {
                // This override matches local addresses.
                if (host.EqualsLiteral("localhost") ||
                    host.EqualsLiteral("127.0.0.1"))
                    return true;
            } else if (PatternMatch(host, override)) {
                return true;
            }
        }

        if (delimiter == end)
            break;
        start = ++delimiter;
    }

    return false;
}

bool
nsWindowsSystemProxySettings::PatternMatch(const nsACString& aHost,
                                           const nsACString& aOverride)
{
    nsAutoCString host(aHost);
    nsAutoCString override(aOverride);
    int32_t overrideLength = override.Length();
    int32_t tokenStart = 0;
    int32_t offset = 0;
    bool star = false;

    while (tokenStart < overrideLength) {
        int32_t tokenEnd = override.FindChar('*', tokenStart);
        if (tokenEnd == tokenStart) {
            star = true;
            tokenStart++;
            // If the character following the '*' is a '.' character then skip
            // it so that "*.foo.com" allows "foo.com".
            if (override.FindChar('.', tokenStart) == tokenStart)
                tokenStart++;
        } else {
            if (tokenEnd == -1)
                tokenEnd = overrideLength;
            nsAutoCString token(Substring(override, tokenStart,
                                          tokenEnd - tokenStart));
            offset = host.Find(token, offset);
            if (offset == -1 || (!star && offset))
                return false;
            star = false;
            tokenStart = tokenEnd;
            offset += token.Length();
        }
    }

    return (star || (offset == host.Length()));
}

nsresult
nsWindowsSystemProxySettings::GetPACURI(nsACString& aResult)
{
    nsresult rv;
    uint32_t flags = 0;
    nsAutoString buf;

    rv = ReadInternetOption(INTERNET_PER_CONN_AUTOCONFIG_URL, flags, buf);
    if (!(flags & PROXY_TYPE_AUTO_PROXY_URL)) {
        aResult.Truncate();
        return rv;
    }

    if (NS_SUCCEEDED(rv))
        aResult = NS_ConvertUTF16toUTF8(buf);
    return rv;
}

nsresult
nsWindowsSystemProxySettings::GetProxyForURI(const nsACString & aSpec,
                                             const nsACString & aScheme,
                                             const nsACString & aHost,
                                             const int32_t      aPort,
                                             nsACString & aResult)
{
    nsresult rv;
    uint32_t flags = 0;
    nsAutoString buf;

    rv = ReadInternetOption(INTERNET_PER_CONN_PROXY_SERVER, flags, buf);
    if (NS_FAILED(rv) || !(flags & PROXY_TYPE_PROXY)) {
        SetProxyResultDirect(aResult);
		if (aScheme.EqualsLiteral("all")){
			
			if (PROXY_TYPE_DIRECT&flags)
				aResult.Append(nsPrintfCString("%s", ";PROXY_TYPE_DIRECT"));
			if (PROXY_TYPE_PROXY&flags)
				aResult.Append(nsPrintfCString("%s", ";PROXY_TYPE_PROXY"));
			if (PROXY_TYPE_AUTO_PROXY_URL&flags)
				aResult.Append(nsPrintfCString("%s", ";PROXY_TYPE_AUTO_PROXY_URL"));
			if (PROXY_TYPE_AUTO_DETECT&flags)
				aResult.Append(nsPrintfCString("%s", ";PROXY_TYPE_AUTO_DETECT"));
			//PROXY_TYPE_DIRECT | PROXY_TYPE_PROXY | PROXY_TYPE_AUTO_PROXY_URL | PROXY_TYPE_AUTO_DETECT
			
		}
        return NS_OK;
    }

    if (MatchOverride(aHost)) {
        SetProxyResultDirect(aResult);
        return NS_OK;
    }

    NS_ConvertUTF16toUTF8 cbuf(buf);

    nsAutoCString prefix;
    ToLowerCase(aScheme, prefix);

    prefix.Append('=');

    nsAutoCString specificProxy;
    nsAutoCString defaultProxy;
    nsAutoCString socksProxy;
    int32_t start = 0;
    int32_t end = cbuf.Length();

    while (true) {
        int32_t delimiter = cbuf.FindCharInSet(" ;", start);
		if (aScheme.EqualsLiteral("all")){
			specificProxy = Substring(cbuf,0,end);
			
			if (PROXY_TYPE_DIRECT&flags)
				specificProxy+=";PROXY_TYPE_DIRECT";
			if (PROXY_TYPE_PROXY&flags)
				specificProxy+=";PROXY_TYPE_PROXY";
			if (PROXY_TYPE_AUTO_PROXY_URL&flags)
				specificProxy+=";PROXY_TYPE_AUTO_PROXY_URL";
			if (PROXY_TYPE_AUTO_DETECT&flags)
				specificProxy+=";PROXY_TYPE_AUTO_DETECT";
			//PROXY_TYPE_DIRECT | PROXY_TYPE_PROXY | PROXY_TYPE_AUTO_PROXY_URL | PROXY_TYPE_AUTO_DETECT
			break;
		}
        if (delimiter == -1)
            delimiter = end;

        if (delimiter != start) {
            const nsAutoCString proxy(Substring(cbuf, start,
                                                delimiter - start));
            if (proxy.FindChar('=') == -1) {
                // If a proxy name is listed by itself, it is used as the
                // default proxy for any protocols that do not have a specific
                // proxy specified.
                // (http://msdn.microsoft.com/en-us/library/aa383996%28VS.85%29.aspx)
                defaultProxy = proxy;
            } else if (proxy.Find(prefix) == 0) {
                // To list a proxy for a specific protocol, the string must
                // follow the format "<protocol>=<protocol>://<proxy_name>".
                // (http://msdn.microsoft.com/en-us/library/aa383996%28VS.85%29.aspx)
                specificProxy = Substring(proxy, prefix.Length());
                break;
            } else if (proxy.Find("socks=") == 0) {
                // SOCKS proxy.
                socksProxy = Substring(proxy, 5); // "socks=" length.
            }
        }

        if (delimiter == end)
            break;
        start = ++delimiter;
    }

    if (!specificProxy.IsEmpty())
        SetProxyResult("PROXY", specificProxy, aResult); // Protocol-specific proxy.
    else if (!defaultProxy.IsEmpty())
        SetProxyResult("PROXY", defaultProxy, aResult); // Default proxy.
    else if (!socksProxy.IsEmpty())
        SetProxyResult("SOCKS", socksProxy, aResult); // SOCKS proxy.
    else
        SetProxyResultDirect(aResult); // Direct connection.

    return NS_OK;
}

nsresult
nsWindowsSystemProxySettings::SetSystemProxyServer(const nsACString & proxyInfo,
                                             const nsACString & flagsInfo,
                                             const nsACString & pacUri,
											 nsACString & aResult)
{
	
	
    INTERNET_PER_CONN_OPTION_LIST list;
    BOOL    bReturn;
    DWORD   dwBufSize = sizeof(list);
	
	nsAutoCString mPacUri;
	nsAutoCString mFlagInfo;
	nsAutoCString mProxyInfo;
    
	ToLowerCase(pacUri, mPacUri);
	ToUpperCase(flagsInfo, mFlagInfo);
	ToLowerCase(proxyInfo, mProxyInfo);
	
	LPTSTR strUri = const_cast<LPSTR>(mPacUri.get());
	LPTSTR strProxyInfo = const_cast<LPSTR>(mProxyInfo.get());
	
    
	
    // Fill the list structure.
    list.dwSize = sizeof(list);

    // NULL == LAN, otherwise connectoid name.
    list.pszConnection = NULL;

	int32_t optionCount = 1;
	if (mFlagInfo.Find("PROXY_TYPE_PROXY")>0)
		optionCount++;
	if (mFlagInfo.Find("PROXY_TYPE_AUTO_PROXY_URL")>0 && mPacUri.Length()>0)
		optionCount++;
    // Set three options.
    list.dwOptionCount = optionCount;
    list.pOptions = new INTERNET_PER_CONN_OPTION[optionCount];

    // Ensure that the memory was allocated.
    if(NULL == list.pOptions)
    {
        // Return FALSE if the memory wasn't allocated.
        return NS_ERROR_FAILURE;
    }
	
    // Set flags.
    //list.pOptions[0].dwOption = INTERNET_PER_CONN_FLAGS;
    //list.pOptions[0].Value.dwValue = PROXY_TYPE_DIRECT |
    //    PROXY_TYPE_PROXY;
	int32_t optionIndex = 0;
	// Set flags.	PROXY_TYPE_DIREC | PROXY_TYPE_PROXY | PROXY_TYPE_AUTO_PROXY_URL | PROXY_TYPE_AUTO_DETECT
	list.pOptions[optionIndex].dwOption = INTERNET_PER_CONN_FLAGS;
	//list.pOptions[0].Value.dwValue = PROXY_TYPE_DIRECT | PROXY_TYPE_PROXY | PROXY_TYPE_AUTO_PROXY_URL | PROXY_TYPE_AUTO_DETECT;
	list.pOptions[optionIndex].Value.dwValue = PROXY_TYPE_DIRECT;
	
	if (mFlagInfo.Find("PROXY_TYPE_PROXY")>0)
		list.pOptions[optionIndex].Value.dwValue |= PROXY_TYPE_PROXY;
	if (mFlagInfo.Find("PROXY_TYPE_AUTO_PROXY_URL")>0)
		list.pOptions[optionIndex].Value.dwValue |= PROXY_TYPE_AUTO_PROXY_URL;
	if (mFlagInfo.Find("PROXY_TYPE_AUTO_DETECT")>0)
		list.pOptions[optionIndex].Value.dwValue |= PROXY_TYPE_AUTO_DETECT;
	optionIndex++;
	// Set PROXY_TYPE_AUTO_PROXY_URL and pacUri !=null
	
	if (mFlagInfo.Find("PROXY_TYPE_AUTO_PROXY_URL")>0 && mPacUri.Length()>0){
		list.pOptions[optionIndex].dwOption = INTERNET_PER_CONN_AUTOCONFIG_URL;
		list.pOptions[optionIndex++].Value.pszValue = strUri;//TEXT("google.com");
	}
	
	if (mFlagInfo.Find("PROXY_TYPE_PROXY")>0){	
    // Set proxy server setting. PROXY_TYPE_PROXY
		list.pOptions[optionIndex].dwOption = INTERNET_PER_CONN_PROXY_SERVER;
		list.pOptions[optionIndex++].Value.pszValue = strProxyInfo;
    }
	

    // Set proxy override.
    //list.pOptions[3].dwOption = INTERNET_PER_CONN_PROXY_BYPASS;
    //list.pOptions[3].Value.pszValue = TEXT("local");

    // Set the options on the connection.
    bReturn = InternetSetOption(NULL, INTERNET_OPTION_PER_CONNECTION_OPTION, &list, dwBufSize);
	
	InternetSetOption(NULL, INTERNET_OPTION_SETTINGS_CHANGED, NULL, NULL);
	InternetSetOption(NULL, INTERNET_OPTION_REFRESH , NULL, 0);
    // Free the allocated memory.
    delete [] list.pOptions;
	
	/* Remove All Proxy Setting and Set to Direct
	list.pOptions[0].dwOption = INTERNET_PER_CONN_FLAGS;  
    list.pOptions[0].Value.dwValue = PROXY_TYPE_DIRECT  ;  
      
    bReturn = InternetSetOption(NULL,INTERNET_OPTION_PER_CONNECTION_OPTION, &list, dwBufferSize);  
   
    delete [] list.pOptions;  
    InternetSetOption(NULL, INTERNET_OPTION_SETTINGS_CHANGED, NULL, 0);  
    InternetSetOption(NULL, INTERNET_OPTION_REFRESH , NULL, 0); 
	*/
	
	return NS_OK;
}



#define NS_WINDOWSSYSTEMPROXYSERVICE_CID  /* 4e22d3ea-aaa2-436e-ada4-9247de57d367 */\
    { 0x4e22d3ea, 0xaaa2, 0x436e, \
        {0xad, 0xa4, 0x92, 0x47, 0xde, 0x57, 0xd3, 0x67 } }

NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsWindowsSystemProxySettings, Init)
NS_DEFINE_NAMED_CID(NS_WINDOWSSYSTEMPROXYSERVICE_CID);

static const mozilla::Module::CIDEntry kSysProxyCIDs[] = {
    { &kNS_WINDOWSSYSTEMPROXYSERVICE_CID, false, nullptr, nsWindowsSystemProxySettingsConstructor },
    { nullptr }
};

static const mozilla::Module::ContractIDEntry kSysProxyContracts[] = {
    { NS_SYSTEMPROXYSETTINGS_CONTRACTID, &kNS_WINDOWSSYSTEMPROXYSERVICE_CID },
    { nullptr }
};

static const mozilla::Module kSysProxyModule = {
    mozilla::Module::kVersion,
    kSysProxyCIDs,
    kSysProxyContracts
};

NSMODULE_DEFN(nsWindowsProxyModule) = &kSysProxyModule;
