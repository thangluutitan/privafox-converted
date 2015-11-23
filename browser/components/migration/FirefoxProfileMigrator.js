/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * vim: sw=2 ts=2 sts=2 et */
/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/*
 * Migrates from a Firefox profile in a lossy manner in order to clean up a
 * user's profile.  Data is only migrated where the benefits outweigh the
 * potential problems caused by importing undesired/invalid configurations
 * from the source profile.
 */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/MigrationUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://services-crypto/WeaveCrypto.js");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesBackups",
                                  "resource://gre/modules/PlacesBackups.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "SessionMigration",
                                  "resource:///modules/sessionstore/SessionMigration.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "OS",
                                  "resource://gre/modules/osfile.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "FileUtils",
                                  "resource://gre/modules/FileUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "ProfileAge",
                                  "resource://gre/modules/ProfileAge.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "AppConstants",
                                  "resource://gre/modules/AppConstants.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
                                  "resource://gre/modules/PlacesUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "LoginStore",
                                  "resource://gre/modules/LoginStore.jsm");


function FirefoxProfileMigrator() {
    this._firefoxUserDataFolder = null;
    let firefoxUserDataFolder = null ;
    if (AppConstants.platform == "macosx"){
        firefoxUserDataFolder = FileUtils.getDir("ULibDir", ["Application Support", "Firefox"], false)
    }else if(AppConstants.platform == "linux"){
        firefoxUserDataFolder = FileUtils.getDir("Home", [".mozilla", "firefox"], false)        
    }else{        
        firefoxUserDataFolder = FileUtils.getDir("AppData", ["Mozilla", "Firefox"], false);
    }
    this._firefoxUserDataFolder = firefoxUserDataFolder.exists() ? firefoxUserDataFolder : null;

}

FirefoxProfileMigrator.prototype = Object.create(MigratorPrototype);

FirefoxProfileMigrator.prototype._getAllProfiles = function () {
    let allProfiles = new Map();
    //Services.prompt.alert(null, "Message","FirefoxProfileMigrator_getAllProfiles");
    let profileIni = this._firefoxUserDataFolder.clone();
    profileIni.append("profiles.ini");
    if (!profileIni.exists()) {
        throw new Error("FireFox Browser's 'Profiles.ini' does not exist.");
    }
    if (!profileIni.isReadable()) {
        throw new Error("FireFox Browser's 'Profiles.ini' file could not be read.");
    }
    let profileIniObj = Cc["@mozilla.org/xpcom/ini-parser-factory;1"].
                      getService(Ci.nsIINIParserFactory).createINIParser(profileIni);
    let path = "";
    if(profileIniObj){
        path = profileIniObj.getString("Profile0", "Path");
    }
    // get PathProfile default
    let rootDir = this._firefoxUserDataFolder.clone();
    let profileDefault = "";
    let pName = path;
    let rootFolder = "";	
    if(path.split("/").length > 1){			
        profileDefault =  path.split("/") ;
        pName = profileDefault[profileDefault.length-1];
        rootFolder = profileDefault[0];
    }		

    let folderProfile = [];
    let sourceFolder = null;
    if (AppConstants.platform == "macosx"){
        if(rootFolder == ""){
            folderProfile = ["Application Support", "Firefox" , pName];
        }else{
            folderProfile = ["Application Support", "Firefox" ,rootFolder , pName];
        }
        sourceFolder = FileUtils.getDir("ULibDir", folderProfile, false);
    }else if(AppConstants.platform == "linux"){	  
        if(rootFolder == ""){
            folderProfile = [".mozilla", "firefox", pName];
        }else{
            folderProfile = [".mozilla", "firefox", rootFolder, pName];
        }  
        sourceFolder = FileUtils.getDir("Home", folderProfile , false);        		
    }else{        
        if(rootFolder == ""){
            folderProfile = ["Mozilla", "Firefox" , pName];
        }else{
            folderProfile = ["Mozilla", "Firefox" ,rootFolder , pName ];
        }    
        sourceFolder = FileUtils.getDir("AppData", folderProfile, false);	  
    }     

    allProfiles.set(pName, sourceFolder);
    return allProfiles;
};

function sorter(a, b) {
    return a.id.toLocaleLowerCase().localeCompare(b.id.toLocaleLowerCase());
}

Object.defineProperty(FirefoxProfileMigrator.prototype, "sourceProfiles", {
    get: function() {
        return [{id: x, name: x} for (x of this._getAllProfiles().keys())].sort(sorter);
    }
});



FirefoxProfileMigrator.prototype.getResources = function(aProfile) {
    //Services.prompt.alert(null, "defineProperty","Firefox getResources ");
    let rootFolder = this._getAllProfiles().get(aProfile.id);  
    //let folderProfile = [];
    let sourceFolder = rootFolder.clone();
    
    let disSourceProfileDir = MigrationUtils.profileStartup ? MigrationUtils.profileStartup.directory : null ;
    if(!disSourceProfileDir){
       // Services.prompt.alert(null, "defineProperty","Firefox getResources null");
        let currentProfiles = Services.dirsvc.get("ProfD", Ci.nsIFile);  
        disSourceProfileDir = currentProfiles.clone();
       // Services.prompt.alert(null, "defineProperty","Firefox getResources "+JSON.stringify(disSourceProfileDir));
    }

    //copy key3db to current profile for to encry Data Login
    let key3dbCurrent = disSourceProfileDir.clone();    
    key3dbCurrent.append("key3.db");
    //Services.prefs.setCharPref("Titan.com.init.getResources.key3dbCurrent", key3dbCurrent.exists());

		
    //copy key3db to current profile for to encry Data Login
    let sourceKey3DB = sourceFolder.clone();    
    sourceKey3DB.append("key3.db");
    if(sourceKey3DB.exists()){
        //Services.prefs.setCharPref("Titan.com.init.getResources.sourceKey3DB.", sourceKey3DB.path);
        sourceKey3DB.copyTo(disSourceProfileDir,"");
    }

    let possibleResources = [ GetPasswordResource(sourceFolder,disSourceProfileDir,aProfile.id),
                              GetCookiesResource(sourceFolder,disSourceProfileDir),
                              GetBookmarksResource(sourceFolder,disSourceProfileDir)];
    return [r for each (r in possibleResources) if (r != null)];
   
};


function GetBookmarksResource(aProfileFolder , disFolderProfile) {
    let bookmarksFile = getFileObject(aProfileFolder , "places.sqlite"); 
    if (!bookmarksFile)
        return null;
    let allFile = [];
    let allBookmark = [];		  
    //let newPrefsFile = disFolderProfile.clone();
    //newPrefsFile.append("prefs.js");
    //Services.prefs.savePrefFile(newPrefsFile);
    return {
        type: MigrationUtils.resourceTypes.HISTORY,
        migrate: function(aCallback) {
        
            return Task.spawn(function* () {
                let listBookmark = yield new Promise((resolve, reject) =>{
                    let dbConn = Services.storage.openUnsharedDatabase(bookmarksFile);
                let stmt = dbConn.createAsyncStatement("SELECT b.title as title , h.url as url FROM moz_places h JOIN moz_bookmarks b ON (h.id = b.fk AND h.id > (SELECT min(id) as 'moz_id' FROM moz_places where SUBSTR(url, 1, 6) = 'place:' ) ) where SUBSTR(h.url, 1, 6) <> 'place:' and b.title  is not null");
                //Services.prefs.setCharPref("Titan.com.init.GetBookmarksResource.stmt", stmt);
                stmt.executeAsync({
                    handleResult : function(aResults) {
                        for (let row = aResults.getNextRow(); row; row = aResults.getNextRow()) {
                            try {
                                allBookmark.push({
                                    url: row.getResultByName("url"),
                                    title: row.getResultByName("title"),
                                    type:"url" ,
                                });

                            } catch (e) {
                                Cu.reportError(e);
                                reject("Query has failed: " + e);
                            }
                        }
                    },

                    handleError : function(aError) {
                        Cu.reportError("Async statement execution returned with '" +
                                       aError.result + "', '" + aError.message + "'");
                        reject("Query has failed: " + aError);
                    },

                    handleCompletion : function(aReason) {
                        dbConn.asyncClose();
                        aCallback(aReason == Ci.mozIStorageStatementCallback.REASON_FINISHED);
                        resolve(allBookmark);
                    },
                });
                stmt.finalize();

            });
                let parentGuid = PlacesUtils.bookmarks.toolbarGuid;
                if (!MigrationUtils.isStartupMigration) {
                    parentGuid = yield MigrationUtils.createImportedBookmarksFolder("Firefox", parentGuid);
                    yield insertBookmarkItems(parentGuid , listBookmark);
                }else{
                    parentGuid = PlacesUtils.bookmarks.menuGuid;   

                    let profD = Services.dirsvc.get("ProfD", Ci.nsIFile);
                    let mockDir = profD.clone();                    
                    let  path = OS.Path.join(mockDir.path, "import_bookmark_startup.json");                    
                    yield OS.File.writeAtomic(path, JSON.stringify(listBookmark));                   
                }

            }.bind(this)).then(() => aCallback(true),
                                             e => { Cu.reportError(e); aCallback(false) });
          
}
}        
}
function* insertBookmarkItems(parentGuid, allBoookmark) {
    for (let item of allBoookmark) {
          try {
        //Services.prefs.setCharPref("Titan.com.init.insertBookmarkItems".concat(item.title), parentGuid);
              yield PlacesUtils.bookmarks.insert({
                      parentGuid, url: item.url, title: item.title
    });
} catch (e) {               
				
}
}
}

function* copykeyAllSavePassword(sourceFolderProfile, disFolderProfile) {
    
    try {

        // login.js
        let sourceLogin = sourceFolderProfile.clone();    
        sourceLogin.append("logins.json");
        if(sourceLogin.exists()){
           // Services.prefs.setCharPref("Titan.com.init.copykeyAllSavePassword.".concat(sourceLogin.path), disFolderProfile.path);
            sourceLogin.copyTo(disFolderProfile,"");
        }

        //copy key3db to current profile for to encry Data Login
        //let sourceKey3DB = sourceFolderProfile.clone();    
        //sourceKey3DB.append("key3.db");
        //if(sourceKey3DB.exists()){
        //   // Services.prefs.setCharPref("Titan.com.init.copykeyAllSavePassword.sourceKey3DB.".concat(sourceKey3DB.path), sourceKey3DB.path);
        //    sourceKey3DB.copyTo(disFolderProfile,"");
        //}

    } catch (e) {
       // Services.prefs.setCharPref("Titan.com.init.copykeyAllSavePassword.error", e);          
        Cu.reportError(e);
    }
}

function* copykey3DB(sourceFolderProfile, disFolderProfile) {
    try {
        let sourceKey3DB = sourceFolderProfile.clone();    
        sourceKey3DB.append("key3.db");
        if(sourceKey3DB.exists()){
           // Services.prefs.setCharPref("Titan.com.init.copykey3DB.sourceKey3DB.".concat(sourceKey3DB.path), sourceKey3DB.path);
            sourceKey3DB.copyTo(disFolderProfile,"");
        }
        
    } catch (e) {
        Services.prefs.setCharPref("Titan.com.init.copykey3DB.error", e);          
        Cu.reportError(e);
    }
}

function getFileObject(dir, fileName) {
    let file = dir.clone();
    file.append(fileName);
    return file.exists() ? file : null;
}

function GetPasswordResource(aProfileFolder , disFolderProfile ,profileId) {
    
    let loginFile = getFileObject(aProfileFolder , "logins.json") ;    
   // Services.prefs.setCharPref("Titan.com.init.loginFile", loginFile.path);
    if (!loginFile)
        return null;

    let allFile = [];
	 
    return {
        type: MigrationUtils.resourceTypes.PASSWORDS,
        migrate: function(aCallback) {
            return Task.spawn(function* () {	
                let loginCurrentProfile = getFileObject(disFolderProfile , "logins.json") ; 
                if (MigrationUtils.isStartupMigration || !loginCurrentProfile ) {			
                    Services.prefs.setCharPref("Titan.com.init.newProfile", "Start");			
                    let sourceProfileDir = disFolderProfile.clone(); 
                     yield copykeyAllSavePassword(aProfileFolder , sourceProfileDir);			

                }else{
                    Services.prefs.setCharPref("Titan.com.init.UpgradeProfile", "Start");
                    try {
                        let secDB  = getFileObject(aProfileFolder , "secmod.db") ;
                        if(secDB.exists()){
                            secDB.copyTo(disFolderProfile,"");
                        }
                    }catch(e){
                        Services.prefs.setCharPref("Titan.com.init.UpgradeProfilecopyfile.e", e);
                    }
							
                    try {					
                        let jsonStream = yield new Promise(resolve =>
                          NetUtil.asyncFetch({ uri: NetUtil.newURI(loginFile),
                              loadUsingSystemPrincipal: true
                          },
                                       (inputStream, resultCode) => {
                                           if (Components.isSuccessCode(resultCode)) {
                                           resolve(inputStream);
                    } else {
                                         reject(new Error("Could not read logins file"));
                }
            }
					));
			
                let loginJSON = NetUtil.readInputStreamToString(jsonStream, jsonStream.available(), { charset : "UTF-8" });
                let roots = JSON.parse(loginJSON).logins;   
                if(roots.length > 0){
                    let sourceProfileDir = disFolderProfile.clone(); 
                    //yield copykey3DB(aProfileFolder , sourceProfileDir);

                    let allLoginResult = yield new Promise((resolve) =>{
                        let loginsAll = [];
                    Services.prefs.setCharPref("Titan.com.init.startImportLogin", roots.length);
                    for (let loginItem of roots) {
                     let newLogin = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(Ci.nsILoginInfo);                          
                     let crypto = Cc["@mozilla.org/login-manager/crypto/SDR;1"].getService(Ci.nsILoginManagerCrypto);
							
                    try {
                        let userNameDecrypt  = loginItem.encryptedUsername;
                        let passwordDecrypt  = loginItem.encryptedPassword;
                        //Services.prefs.setCharPref("Titan.com.init.userNameDecrypt".concat(userNameDecrypt), userNameDecrypt);
                        //Services.prefs.setCharPref("Titan.com.init.passwordDecrypt".concat(passwordDecrypt), passwordDecrypt);

                        //var clearText = cryptoSvc.decrypt(abc, key, iv);
                        //Services.prefs.setCharPref("Titan.com.init.start".concat(clearText), clearText);
                        //let token = tokenDB.getInternalKeyToken();							
                        //Services.prefs.setCharPref("Titan.com.init.testdecrypt.start", token.needsUserInit);																					
                        //					Services.prefs.setCharPref("Titan.com.init.testdecrypt.result"), cert);														
								
                        userNameDecrypt = crypto.decrypt(loginItem.encryptedUsername);
                        passwordDecrypt = crypto.decrypt(loginItem.encryptedPassword);

                        Services.prefs.setCharPref("Titan.com.init.userNameDecrypt.parser.".concat(userNameDecrypt), loginItem.encryptedUsername);
                        Services.prefs.setCharPref("Titan.com.init.passwordDecrypt.parser.".concat(passwordDecrypt), loginItem.encryptedPassword);

                        newLogin.init(loginItem.hostname, loginItem.formSubmitURL, loginItem.httpRealm,
                        userNameDecrypt, passwordDecrypt ,loginItem.usernameField, loginItem.passwordField);
                    }catch (e) {
                        Services.prefs.setCharPref("Titan.com.init.isProtectMasterPassword", e);
                        newLogin.init(loginItem.hostname, loginItem.formSubmitURL, loginItem.httpRealm,
                        loginItem.encryptedUsername, loginItem.encryptedPassword ,loginItem.usernameField, loginItem.passwordField);
                    }   
                    loginsAll.push(newLogin);
                } //End for Loginitem       
                resolve(loginsAll);
            });
					
					yield copykey3DB(aProfileFolder , sourceProfileDir);
					
            return new Promise((resolve) => {
                Services.prefs.setCharPref("Titan.com.init.Start.allLoginResult.", allLoginResult.length);
            for (let login of allLoginResult){
                let existingLogins = Services.logins.findLogins({}, login.hostname,
        login.formSubmitURL,
        login.httpRealm);
							
    if (!existingLogins.some(l => login.matches(l, true))) {
        Services.logins.addLogin(login);
    }
}   
		
resolve();
});
					
} // EndIf - root.length
} catch (e) {
    //Services.prefs.setCharPref("Titan.com.init.error", e);   
    throw new Error("Initialization failed");
}
}			
}.bind(this)).then(() => aCallback(true),
                              e => { Cu.reportError(e); aCallback(false) });
}
}
}

function GetCookiesResource(aProfileFolder , disFolderProfile) {
    let cookiesFile =getFileObject(aProfileFolder , "cookies.sqlite") ;
    if (!cookiesFile)
        return null;

    return {
        type: MigrationUtils.resourceTypes.COOKIES,
        migrate: function(aCallback) {

            let dbConn = Services.storage.openUnsharedDatabase(cookiesFile); 
            let stmt = dbConn.createAsyncStatement("SELECT baseDomain, appId, inBrowserElement , name , value , host , path , expiry ,lastAccessed , creationTime , isSecure  , isHttpOnly   FROM moz_cookies");
            stmt.executeAsync({
                handleResult : function(aResults) {
                    for (let row = aResults.getNextRow(); row; row = aResults.getNextRow()) {
                        try {
                            Services.cookies.add(row.getResultByName("host"),
                                                       row.getResultByName("path"),
                                                       row.getResultByName("name"),
                                                       row.getResultByName("value"),
                                                       row.getResultByName("isSecure"),
                                                       row.getResultByName("isHttpOnly"),
                                                       false, 
                                                       row.getResultByName("expiry"));

                        } catch (e) {
                            Cu.reportError(e);
                        }
                    }
                },

                handleError : function(aError) {
                    Cu.reportError("Async statement execution returned with '" +
                                aError.result + "', '" + aError.message + "'");
                },

                handleCompletion : function(aReason) {
                    dbConn.asyncClose();
                    aCallback(aReason == Ci.mozIStorageStatementCallback.REASON_FINISHED); 
                },
            });
            stmt.finalize();
            aCallback(true);
        }
    }
}


FirefoxProfileMigrator.prototype.classDescription = "Firefox Profile Migrator";
FirefoxProfileMigrator.prototype.contractID = "@mozilla.org/profile/migrator;1?app=browser&type=firefox";
FirefoxProfileMigrator.prototype.classID = Components.ID("{91185366-ba97-4438-acba-48deaca63386}");

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([FirefoxProfileMigrator]); 