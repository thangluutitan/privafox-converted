/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
Components.utils.import('resource://gre/modules/Services.jsm');
function init() {
    let enableProtecBookmark = Services.prefs.getBoolPref("security.additionalSecurity.protectBookmark");
    let searchContainer = document.getElementById("sidebar-search-container");
    searchContainer.hidden = enableProtecBookmark;
    let bookmarksContainer = document.getElementById("bookmarks-view");
    bookmarksContainer.hidden = enableProtecBookmark;
    document.getElementById("bookmarks-view").place =
    "place:queryType=1&folder=" + window.top.PlacesUIUtils.allBookmarksFolderId;
}
function checkProtecBookmark(){
    
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
