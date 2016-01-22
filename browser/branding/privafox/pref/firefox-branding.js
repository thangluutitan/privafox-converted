/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

pref("startup.homepage_override_url", "https://www.privafox.com/firstrun.html?l=%LOCALE%&v=%VERSION%");
pref("startup.homepage_welcome_url", "https://www.privafox.com/firstrun.html?l=%LOCALE%&v=%VERSION%");
pref("startup.homepage_welcome_url.additional", "");
// The time interval between checks for a new version (in seconds)
pref("app.update.interval", 7200); // 2 hours

//Privafox Pref

//Privafox Auto Update Notification
pref("browser.autoUpdateNotify.dontShowAgain", false);
pref("browser.autoUpdateNotify.lastShow", 0);
pref("browser.checkAutoUpdateNotify.interval", 86400);//86400 - 24h
pref("browser.autoUpdateNotify.message", "It is strongly recommended to enable automatic updates - but the choice is yours.");
pref("browser.autoUpdateNotify.WhyUrl","https://www.privafox.com/support/why-auto-update.html?v=%VERSION%&l=%LOCALE%&os=%OS%");

//Privafox: ProxyChange Notification
pref("browser.proxyChange.lastProxyInfo.type",0);
pref("browser.proxyChange.lastProxyInfo.http","");
pref("browser.proxyChange.lastProxyInfo.http_port",0);
pref("browser.proxyChange.lastProxyInfo.ftp","");
pref("browser.proxyChange.lastProxyInfo.ftp_port",0);
pref("browser.proxyChange.lastProxyInfo.ssl","");
pref("browser.proxyChange.lastProxyInfo.ssl_port",0);
pref("browser.proxyChange.lastProxyInfo.socks","");
pref("browser.proxyChange.lastProxyInfo.socks_port",0);
pref("browser.proxyChange.lastProxyInfo.socks_version",5);
pref("browser.proxyChange.lastProxyInfo.socks_remote_dns",false);
pref("browser.proxyChange.lastProxyInfo.share_proxy_settings",false);
pref("browser.proxyChange.lastProxyInfo.no_proxies_on","localhost, 127.0.0.1");
pref("browser.proxyChange.lastProxyInfo.autoconfig_url","");

//Privafox: SystemProxyChange Notification
pref("browser.proxyChange.lastSystemProxyInfo.isChange",false);
pref("browser.proxyChange.lastSystemProxyInfo.http","");
pref("browser.proxyChange.lastSystemProxyInfo.http_port",0);
pref("browser.proxyChange.lastSystemProxyInfo.ftp","");
pref("browser.proxyChange.lastSystemProxyInfo.ftp_port",0);
pref("browser.proxyChange.lastSystemProxyInfo.ssl","");
pref("browser.proxyChange.lastSystemProxyInfo.ssl_port",0);
pref("browser.proxyChange.lastSystemProxyInfo.socks","");
pref("browser.proxyChange.lastSystemProxyInfo.socks_port",0);
pref("browser.proxyChange.lastSystemProxyInfo.share_proxy_settings",false);
pref("browser.proxyChange.lastSystemProxyInfo.autoconfig",false);
pref("browser.proxyChange.lastSystemProxyInfo.autoconfig_url","");
pref("browser.proxyChange.lastSystemProxyInfo.autoDetect",false);
pref("browser.proxyChange.lastSystemProxyInfo.sameProxyServer",false);
pref("browser.proxyChange.lastSystemProxyInfo.mode",0);

//More properties for MacOS
pref("browser.proxyChange.lastSystemProxyInfo.HTTPEnable",false);
pref("browser.proxyChange.lastSystemProxyInfo.HTTPSEnable",false);
pref("browser.proxyChange.lastSystemProxyInfo.FTPEnable",false);
pref("browser.proxyChange.lastSystemProxyInfo.SOCKSEnable",false);
pref("browser.proxyChange.lastSystemProxyInfo.RTSPEnable",false);

pref("browser.proxyChange.lastSystemProxyInfo.RTSPProxy","");
pref("browser.proxyChange.lastSystemProxyInfo.RTSPPort",0);

pref("browser.proxyChange.lastSystemProxyInfo.GopherEnable",false);
pref("browser.proxyChange.lastSystemProxyInfo.GopherProxy","");
pref("browser.proxyChange.lastSystemProxyInfo.GopherPort",0);

pref("browser.proxyChange.lastSystemProxyInfo.GopherUser","");
pref("browser.proxyChange.lastSystemProxyInfo.RTSPUser","");
pref("browser.proxyChange.lastSystemProxyInfo.HTTPSUser","");
pref("browser.proxyChange.lastSystemProxyInfo.HTTPUser","");
pref("browser.proxyChange.lastSystemProxyInfo.SOCKSUser","");
pref("browser.proxyChange.lastSystemProxyInfo.HTTPUser","");


pref("browser.proxyChange.lastSystemProxyInfo.FTPPassive",true);
pref("browser.proxyChange.lastSystemProxyInfo.ExceptionsList","");
pref("browser.proxyChange.lastSystemProxyInfo.ExcludeSimpleHostnames",false);

pref("browser.proxyChange.isChange", false);
pref("browser.proxyChange.message", "Warning: Your proxy settings have changed since last run.");
pref("browser.proxyChange.lastShow", 0);
pref("browser.checkProxyChange.interval", 86400);//86400 - 24h

// The time interval between the downloading of mar file chunks in the
// background (in seconds)
// 0 means "download everything at once"
pref("app.update.download.backgroundInterval", 0);
// Give the user x seconds to react before showing the big UI. default=12 hours
pref("app.update.promptWaitTime", 43200);
// URL user can browse to manually if for some reason all update installation
// attempts fail.
pref("app.update.url.manual", "https://www.privafox.com");
// A default value for the "More information about this update" link
// supplied in the "An update is available" page of the update wizard. 
pref("app.update.url.details", "https://www.privafox.com/releasenotes.html?l=%LOCALE%");

// The number of days a binary is permitted to be old
// without checking for an update.  This assumes that
// app.update.checkInstallTime is true.
pref("app.update.checkInstallTime.days", 2);

// Give the user x seconds to reboot before showing a badge on the hamburger
// button. default=immediately
pref("app.update.badgeWaitTime", 0);

// code usage depends on contracts, please contact the Firefox module owner if you have questions
pref("browser.search.param.yahoo-fr", "moz35");
pref("browser.search.param.yahoo-fr-ja", "mozff");

// Number of usages of the web console or scratchpad.
// If this is less than 5, then pasting code into the web console or scratchpad is disabled
pref("devtools.selfxss.count", 5);
