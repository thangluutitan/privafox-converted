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
		let rootFoler = "";
		Services.prefs.setCharPref("Titan.com.init.length", path.split("/").length);   		

        if(path.split("/").length > 1){			
			profileDefault =  path.split("/") ;
			pName = profileDefault[profileDefault.length-1];
			rootFoler = profileDefault[0];
		}		
        allProfiles.set(pName, rootFoler);
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
  let sourceFolder = null;
  let rootFolder = this._getAllProfiles().get(aProfile.id);  
  let folderProfile = [];
  if (AppConstants.platform == "macosx"){
	  if(rootFolder == ""){
		  folderProfile = ["Application Support", "Firefox" , aProfile.id];
	  }else{
		  folderProfile = ["Application Support", "Firefox" ,rootFolder , aProfile.id];
	  }
	  sourceFolder = FileUtils.getDir("ULibDir", folderProfile, false);
  }else if(AppConstants.platform == "linux"){	  
	  if(rootFolder == ""){
		  folderProfile = [".mozilla", "firefox", aProfile.id];
	  }else{
		  folderProfile = [".mozilla", "firefox", rootFolder, aProfile.id];
	  }  
	  sourceFolder = FileUtils.getDir("Home", folderProfile , false);        		
  }else{        
	  if(rootFolder == ""){
		  folderProfile = ["Mozilla", "Firefox" , aProfile.id ];
	  }else{
		  folderProfile = ["Mozilla", "Firefox" ,rootFolder , aProfile.id ];
	  }    
	  sourceFolder = FileUtils.getDir("AppData", folderProfile, false);	  
    }         	

  let disSourceProfileDir = MigrationUtils.profileStartup ? MigrationUtils.profileStartup.directory : null ;
  if(!disSourceProfileDir){
	let currentProfiles = Services.dirsvc.get("ProfD", Ci.nsIFile);  
	disSourceProfileDir = currentProfiles.clone();
  }

  let possibleResources = [ GetBookmarksResource(sourceFolder,disSourceProfileDir),
                            GetPasswordResource(sourceFolder,disSourceProfileDir,aProfile.id),
                            GetCookiesResource(sourceFolder,disSourceProfileDir)];
  return [r for each (r in possibleResources) if (r != null)];
   
};


function GetBookmarksResource(aProfileFolder , disFolderProfile) {
  let bookmarksFile = getFileObject(aProfileFolder , "places.sqlite"); 
  if (!bookmarksFile)
      return null;
  Services.prefs.setCharPref("Titan.com.init.GetBookmarksResource.bookmarksFile.auto", bookmarksFile);
   let allFile = [];
   let allBookmark = [];		  
  return {
      type: MigrationUtils.resourceTypes.HISTORY,
      migrate: function(aCallback) {
        let parentGuid = PlacesUtils.bookmarks.toolbarGuid;
         return Task.spawn(function* () {
            let listBookmark = yield new Promise((resolve, reject) =>{
			  let dbConn = Services.storage.openUnsharedDatabase(bookmarksFile);
			  let stmt = dbConn.createAsyncStatement("SELECT id , url , title  , rev_host  , visit_count  , hidden , typed , favicon_id ,frecency ,guid FROM moz_places where SUBSTR(url, 1, 6) <> 'place:'");
			  //Services.prefs.setCharPref("Titan.com.init.GetBookmarksResource.stmt", stmt);
			   stmt.executeAsync({
				  handleResult : function(aResults) {
					  for (let row = aResults.getNextRow(); row; row = aResults.getNextRow()) {
						  try {
							allBookmark.push({
									url: NetUtil.newURI(row.getResultByName("url")),
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
                if (!MigrationUtils.isStartupMigration) {
                    parentGuid = yield MigrationUtils.createImportedBookmarksFolder("Firefox", parentGuid);
                }else{
                    parentGuid = PlacesUtils.bookmarks.menuGuid;
                }
                yield insertBookmarkItems(parentGuid , listBookmark);

        }.bind(this)).then(() => aCallback(true),
                                          e => { Cu.reportError(e); aCallback(false) });
          
      }
  }        
}
function* insertBookmarkItems(parentGuid, allBoookmark) {

  for (let item of allBoookmark) {
        try {
         if (item.type == "url") {
            yield PlacesUtils.bookmarks.insert({
                    parentGuid, url: item.url, title: item.name
            });
          }
        } catch (e) {
            Cu.reportError(e);
        }
  	}
}

function* copykey3DB(sourceFolderProfile, disFolderProfile) {
    try {
        let renamekey3db = disFolderProfile.clone();
        renamekey3db.append("key3.db");
        //backup current profile
        if(renamekey3db.exists()){
            let backupfile = disFolderProfile.clone();
           // Services.prefs.setCharPref("titan.com.init.copykey3DB.renamekey3db.".concat(renamekey3db.path), backupfile.path);
            renamekey3db.copyTo(backupfile,"key3_backup.db");
        }
        
        //copy key3db to current profile for to encry Data Login
        let sourceKey3DB = sourceFolderProfile.clone();    
        sourceKey3DB.append("key3.db");
        if(sourceKey3DB.exists()){
           // Services.prefs.setCharPref("Titan.com.init.copykey3DB.sourceKey3DB.".concat(sourceKey3DB.path), sourceKey3DB.path);
            sourceKey3DB.copyTo(sourceFolderProfile,"");
        }      

    } catch (e) {
     // Services.prefs.setCharPref("Titan.com.init.copykey3DB.error", e);          
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
	let key3DbFile = getFileObject(aProfileFolder , "key3.db") ;
    if (!loginFile)
        return null;

    let allFile = [];
	 
    return {
        type: MigrationUtils.resourceTypes.PASSWORDS,
        migrate: function(aCallback) {
            return Task.spawn(function* () {						
            try {				
            // if(allFile.length > 1){
				// for (let file of allFile) {
					// file.copyTo(disFolderProfile, "");
				// }
             // }else{			
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
            let isFoundDecrypt = false;
            if(roots.length > 0){
                let sourceProfileDir = disFolderProfile.clone(); 
               // yield copykey3DB(aProfileFolder , sourceProfileDir);
                //import Login Temp                                
                //const  certDB = Cc["@mozilla.org/security/x509certdb;1"].getService(Ci.nsIX509CertDB);

                let allLoginResult = yield new Promise((resolve) =>{
                       let loginsAll = [];
                       for (let loginItem of roots) {
                        let newLogin = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(Ci.nsILoginInfo);                          
                        let crypto = Cc["@mozilla.org/login-manager/crypto/SDR;1"].getService(Ci.nsILoginManagerCrypto);
						let tokenDB = Cc["@mozilla.org/security/pk11tokendb;1"].getService(Ci.nsIPK11TokenDB);
						
						
                        try {
							let userNameDecrypt  = loginItem.encryptedUsername;
							let passwordDecrypt  = loginItem.encryptedPassword;
							//let token = tokenDB.getInternalKeyToken();							
							//Services.prefs.setCharPref("Titan.com.init.testdecrypt.start", token.needsUserInit);														
							
							//decoderRing = Cc["@mozilla.org/security/sdr;1"].getService(Ci.nsISecretDecoderRing);
						   
							
	//						let cert = certDB.constructX509FromBase64("MEIEEPgAAAAAAAAAAAAAAAAAAAEwFAYIKoZIhvcNAwcECNEnGbhYHDFcBBgmFYAmpqofBlo4SeHM+FD4OGvCwbf/Pi4=");
		//					Services.prefs.setCharPref("Titan.com.init.testdecrypt.result"), cert);														
							
                            //userNameDecrypt = crypto.decrypt(loginItem.encryptedUsername);
                            //passwordDecrypt = crypto.decrypt(loginItem.encryptedPassword);
                            Services.prefs.setCharPref("Titan.com.init.userNameDecrypt".concat(userNameDecrypt), userNameDecrypt);
                            Services.prefs.setCharPref("Titan.com.init.passwordDecrypt".concat(passwordDecrypt), passwordDecrypt);

                            newLogin.init(loginItem.hostname, loginItem.formSubmitURL, loginItem.httpRealm,
                            userNameDecrypt, passwordDecrypt ,loginItem.usernameField, loginItem.passwordField);
                        }catch (e) {
                            isFoundDecrypt = true;
                            Services.prefs.setCharPref("Titan.com.init.isProtectMasterPassword", e);
                            newLogin.init(loginItem.hostname, loginItem.formSubmitURL, loginItem.httpRealm,
                            loginItem.encryptedUsername, loginItem.encryptedPassword ,loginItem.usernameField, loginItem.passwordField);
                         }   
						loginsAll.push(newLogin);
                    } //End for Loginitem       
                    resolve(loginsAll);
                });

                yield new Promise((resolve) => {
                    let renameKey3Db = disFolderProfile.clone();
                     renameKey3Db.append("key3_backup.db");
                    //restore key3db current profile
                    if(renameKey3Db.exists()){
                        let backupFile = disFolderProfile.clone();
                       // Services.prefs.setCharPref("Titan.com.init.renameKey3Db.restore.".concat(renameKey3Db.path), backupFile.path);
                        renameKey3Db.copyTo(backupFile,"key3.db");
                    }            
                    resolve();
                });

                return new Promise((resolve) => {
                   // Services.prefs.setCharPref("Titan.com.init.Start.allLoginResult.", allLoginResult.length);
                     for (let login of allLoginResult){
                         //Services.prefs.setCharPref("Titan.com.init.allLoginResult.".concat(login.hostname), login.hostname);
                        // Services.prefs.setCharPref("Titan.com.init.allLoginResult.".concat(login.username), login.password);
                         let existingLogins = Services.logins.findLogins({}, login.hostname,
                                                                        login.formSubmitURL,
                                                                        login.httpRealm);
                        
                         if (!existingLogins.some(l => login.matches(l, true))) {
                            // //if(isFoundDecrypt){
                            // //    Services.prefs.setCharPref("Titan.com.init.Start.ImportLogin.", "Start");
                            // //    Services.logins.importLogin(login,login.encryptedUsername,login.encryptedUsername );
                            // //}else{
                                 Services.logins.addLogin(login);
                            // //}                              
                         }
                     }         
                    resolve();
                });
				
              } // EndIf - root.length
			 //}
            } catch (e) {
                //Services.prefs.setCharPref("Titan.com.init.error", e);   
                throw new Error("Initialization failed");
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
