/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
Components.utils.import('resource://gre/modules/Services.jsm');

function init() {
    showBookmark();
    document.getElementById("bookmarks-view").place =
    "place:queryType=1&folder=" + window.top.PlacesUIUtils.allBookmarksFolderId;
}
function showBookmark() {
    let isHasProtectBookmark = this.bookmarkIsProtectMasterPassword();
    let searchContainer = document.getElementById("sidebar-search-container");
    let bookmarksContainer = document.getElementById("bookmarks-view");
     searchContainer.hidden = isHasProtectBookmark;
     bookmarksContainer.hidden = isHasProtectBookmark;
}

function bookmarkIsProtectMasterPassword() {
    let kCheckBookmarksIsMasterPassword = Services.prefs.getBoolPref("security.additionalSecurity.protectBookmark");
    let kAlreadyLogin = Services.prefs.getBoolPref("security.additionalSecurity.protectBookmark.isAlreadyLogin");
    var hasProtectPassword = false;
    if(kCheckBookmarksIsMasterPassword && kAlreadyLogin){
        hasProtectPassword =  false;
    }else if(kCheckBookmarksIsMasterPassword){
        hasProtectPassword =  true;
        var tokendb = Components.classes["@mozilla.org/security/pk11tokendb;1"].createInstance(Components.interfaces.nsIPK11TokenDB);
        var token = tokendb.getInternalKeyToken();
        // if there is no master password, still give the user a chance to opt-out of displaying passwords
        if (token.checkPassword("")){
            hasProtectPassword =  false;
        }           
    }
    return hasProtectPassword;
}
function searchBookmarks(aSearchString) {
  var tree = document.getElementById('bookmarks-view');
  if (!aSearchString)
    tree.place = tree.place;
  else
    tree.applyFilter(aSearchString,
                     [PlacesUtils.bookmarksMenuFolderId,
                      PlacesUtils.unfiledBookmarksFolderId,
                      PlacesUtils.toolbarFolderId]);
}

window.addEventListener("SidebarFocused",
                        function()
                          document.getElementById("search-box").focus(),
                        false);

window.addEventListener("refreshBookmark",
                        function()
                            showBookmark(),
                        false);