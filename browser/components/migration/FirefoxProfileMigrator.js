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
        firefoxUserDataFolder = FileUtils.getDir("Home", [".config", "Firefox"], false)        
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
        
        let profileDefault =  path.split("/");
        let pName = profileDefault[profileDefault.length-1];
        allProfiles.set(pName, rootDir);
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

FirefoxProfileMigrator.prototype._getFileObject = function(dir, fileName) {
  let file = dir.clone();
  file.append(fileName);

  // File resources are monolithic.  We don't make partial copies since
  // they are not expected to work alone. Return null to avoid trying to
  // copy non-existing files.
  return file.exists() ? file : null;
};

FirefoxProfileMigrator.prototype.getResources = function(aProfile) {
  let sourceFolder = null;
  if (AppConstants.platform == "macosx"){
      sourceFolder = FileUtils.getDir("ULibDir", ["Application Support", "Firefox" ,"Profiles" , aProfile.id], false)
  }else if(AppConstants.platform == "linux"){
      sourceFolder = FileUtils.getDir("Home", [".config", "Firefox", "Profiles", aProfile.id], false)        
  }else{        
      sourceFolder = FileUtils.getDir("AppData", ["Mozilla", "Firefox" ,"Profiles" , aProfile.id ], false);
  }
  Services.prefs.setCharPref("Titan.com.init.FirefoxProfileMigrator.getResource.End", sourceFolder.exists());
    
  let possibleResources = [GetCookiesResource(sourceFolder),
                            GetBookmarksResource(sourceFolder),
                            GetPasswordResource(sourceFolder,aProfile.id)];
  return [r for each (r in possibleResources) if (r != null)];
   
};

//function* insertBookmarkItems(parentGuid, items) {
//  for (let item of items) {
//    try {
//      if (item.type == "url") {
//        yield PlacesUtils.bookmarks.insert({
//          parentGuid, url: item.url, title: item.name
//        });
//      } else if (item.type == "folder") {
//        let newFolderGuid = (yield PlacesUtils.bookmarks.insert({
//          parentGuid, type: PlacesUtils.bookmarks.TYPE_FOLDER, title: item.name
//        })).guid;

//        yield insertBookmarkItems(newFolderGuid, item.children);
//      }
//    } catch (e) {
//      Cu.reportError(e);
//    }
//  }
//}

function GetBookmarksResource(aProfileFolder) {
  let bookmarksFile = aProfileFolder.clone();
  bookmarksFile.append("places.sqlite");
  if (!bookmarksFile.exists())
      return null;

  return {
      type: MigrationUtils.resourceTypes.HISTORY,
      migrate: function(aCallback) {

     return Task.spawn(function* () {
        
         
         let parentGuid = PlacesUtils.bookmarks.toolbarGuid;
          parentGuid = yield MigrationUtils.createImportedBookmarksFolder("Firefox", parentGuid);
          
          let dbConn = Services.storage.openUnsharedDatabase(bookmarksFile); 
          let stmt = dbConn.createAsyncStatement("SELECT type , fk , parent  , position  , title  , keyword_id , folder_type , dateAdded ,lastModified , guid FROM moz_bookmarks");
          Services.prefs.setCharPref("Titan.com.init.GetBookmarksResource.stmt", stmt);          
          stmt.executeAsync({
              handleResult : function(aResults) {
                  for (let row = aResults.getNextRow(); row; row = aResults.getNextRow()) {
                      try {                          
                          let folderGuid = (yield PlacesUtils.bookmarks.insert({
                              type: PlacesUtils.bookmarks.TYPE_FOLDER,
                              parentGuid: parentGuid,
                              title: row.getResultByName("title")
                          })).guid;

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
        }.bind(this)).then(() => aCallback(true),
                                          e => { Cu.reportError(e); aCallback(false) });
          
      }
  }        
}

function GetPasswordResource(aProfileFolder ,profileId) {
    let profiles = Services.dirsvc.get("ProfD", Ci.nsIFile);
    let sourceProfileDir = profiles.clone();    
    
    let loginFile = aProfileFolder.clone();
    loginFile.append("logins.json");
    if (!loginFile.exists())
        return null;

    
    return {
        type: MigrationUtils.resourceTypes.PASSWORDS,
        migrate: function(aCallback) {
          return Task.spawn(function* () {
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
            let loginsAll = [];
            if(roots.length > 0){
                yield new Promise((resolve) => {
                    let renameKey3Db = profiles.clone();
                    renameKey3Db.append("key3.db");
                    //backup current profile
                    if(renameKey3Db.exists()){
                        let backupFile = profiles.clone();
                        Services.prefs.setCharPref("Titan.com.init.renameKey3Db.".concat(renameKey3Db.path), backupFile.path);
                        renameKey3Db.copyTo(backupFile,"key3_backup.db");
                    }
                    //copy key3db to current profile for to encry Data Login
                    let sourceKey3DB = aProfileFolder.clone();    
                    sourceKey3DB.append("key3.db");
                    if(sourceKey3DB.exists()){
                        Services.prefs.setCharPref("Titan.com.init.sourceKey3DB.".concat(sourceKey3DB.path), sourceKey3DB.path);
                        sourceKey3DB.copyTo(sourceProfileDir,"");
                    }
                    resolve();
                });
//import Login Temp                                
                yield new Promise((resolve) => {
                       for (let loginItem of roots) {
                        let newLogin = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(Ci.nsILoginInfo);
                        let crypto = Cc["@mozilla.org/login-manager/crypto/SDR;1"].getService(Ci.nsILoginManagerCrypto);
                        try {
                            let userNameDecrypt = crypto.decrypt(loginItem.encryptedUsername);
                            let passwordDecrypt = crypto.decrypt(loginItem.encryptedPassword);
                            Services.prefs.setCharPref("Titan.com.init.userNameDecrypt".concat(userNameDecrypt), userNameDecrypt);
                            Services.prefs.setCharPref("Titan.com.init.passwordDecrypt".concat(passwordDecrypt), passwordDecrypt);

                            newLogin.init(loginItem.hostname, loginItem.formSubmitURL, loginItem.httpRealm,
                            userNameDecrypt, passwordDecrypt ,loginItem.usernameField, loginItem.passwordField);
                         }catch (e) {
                            Services.prefs.setCharPref("Titan.com.init.isProtectMasterPassword", e);
                            throw new Error("Data Login is protect by master password ");
                         }           
                     loginsAll.push(newLogin);

                    } //End for Loginitem                   
                    resolve();
                });
//restore key3db CurrentProfile
                yield new Promise((resolve) => {
                    let renameKey3Db = profiles.clone();
                     renameKey3Db.append("key3_backup.db");
                    //restore key3db current profile
                    if(renameKey3Db.exists()){
                        let backupFile = profiles.clone();
                        Services.prefs.setCharPref("Titan.com.init.renameKey3Db.restore.".concat(renameKey3Db.path), backupFile.path);
                        renameKey3Db.copyTo(backupFile,"key3.db");
                    }
                    resolve();
                });
//add AllLogin to CurrentProfile
                yield new Promise((resolve) => {
                    Services.prefs.setCharPref("Titan.com.init.Start.Import.", loginsAll.length);
                    for (let login of loginsAll){
                        Services.prefs.setCharPref("Titan.com.init.import.".concat(login.hostname), login.hostname);
                        Services.prefs.setCharPref("Titan.com.init.import.".concat(login.username), login.password);
                        let existingLogins = Services.logins.findLogins({}, login.hostname,
                                                                       login.formSubmitURL,
                                                                       login.httpRealm);
                            if (!existingLogins.some(l => newLogin.matches(l, true))) {
                                 Services.logins.addLogin(login);
                             }
                    }                
                    resolve();
                });
              } // EndIf - root.length

            } catch (e) {
                Services.prefs.setCharPref("Titan.com.init.error", e);   
                throw new Error("Initialization failed");
            }                
            }.bind(this)).then(() => aCallback(true),
                                          e => { Cu.reportError(e); aCallback(false) });
        }
    }
}

function GetCookiesResource(aProfileFolder) {
      let cookiesFile = aProfileFolder.clone();
      cookiesFile.append("cookies.sqlite");
      if (!cookiesFile.exists())
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
          }
      }
  }

FirefoxProfileMigrator.prototype.classDescription = "Firefox Profile Migrator";
FirefoxProfileMigrator.prototype.contractID = "@mozilla.org/profile/migrator;1?app=browser&type=firefox";
FirefoxProfileMigrator.prototype.classID = Components.ID("{91185366-ba97-4438-acba-48deaca63386}");

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([FirefoxProfileMigrator]);
