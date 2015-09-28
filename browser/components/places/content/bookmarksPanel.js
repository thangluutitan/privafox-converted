/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
Components.utils.import('resource://gre/modules/Services.jsm');
function init() {
    let kEnableProtecBookmark = Services.prefs.getBoolPref("security.additionalSecurity.protectBookmark");
    let kAlreadyLogin = Services.prefs.getBoolPref("security.additionalSecurity.protectBookmark.isAlreadyLogin");
    let masterPasswordContainer = document.getElementById("sidebar-enter-masterpassword-container");
    let searchContainer = document.getElementById("sidebar-search-container");
    let bookmarksContainer = document.getElementById("bookmarks-view");
    if(kEnableProtecBookmark && kAlreadyLogin){
            masterPasswordContainer.hidden = kEnableProtecBookmark ;
            searchContainer.hidden = !kEnableProtecBookmark;
            bookmarksContainer.hidden = !kEnableProtecBookmark
    }else if(!kEnableProtecBookmark){
            masterPasswordContainer.hidden = !kEnableProtecBookmark ;
            searchContainer.hidden = kEnableProtecBookmark;
            bookmarksContainer.hidden = kEnableProtecBookmark;
    }else{
           masterPasswordContainer.hidden = kAlreadyLogin ;
           searchContainer.hidden = !kAlreadyLogin;
           bookmarksContainer.hidden = !kAlreadyLogin;
    }
    document.getElementById("bookmarks-view").place =
    "place:queryType=1&folder=" + window.top.PlacesUIUtils.allBookmarksFolderId;
}

function checkProtecBookmark() {    
    Services.obs.notifyObservers(window, "bookmark-protect-master-password", "");
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
