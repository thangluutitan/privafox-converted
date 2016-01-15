/* -*- Mode: Java; c-basic-offset: 4; tab-width: 20; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.home;

import java.util.List;

import org.mozilla.gecko.GeckoProfile;
import org.mozilla.gecko.R;
import org.mozilla.gecko.db.BrowserContract.Bookmarks;
import org.mozilla.gecko.db.BrowserDB;
import org.mozilla.gecko.home.BookmarksListAdapter.FolderInfo;
import org.mozilla.gecko.home.BookmarksListAdapter.OnRefreshFolderListener;
import org.mozilla.gecko.home.BookmarksListAdapter.RefreshType;
import org.mozilla.gecko.home.HomeContextMenuInfo.RemoveItemType;
import org.mozilla.gecko.home.HomePager.OnUrlOpenListener;

import android.app.Activity;
import android.content.Context;
import android.content.res.Configuration;
import android.database.Cursor;
import android.os.Bundle;
import android.support.v4.content.Loader;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewStub;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Button;
import android.view.View.OnClickListener;
import android.util.Log;
import org.mozilla.gecko.EventDispatcher;
import org.mozilla.gecko.util.NativeEventListener;
import org.mozilla.gecko.util.EventCallback;
import org.mozilla.gecko.util.NativeJSObject;
import org.mozilla.gecko.util.GeckoEventListener;
import org.json.JSONException;
import org.json.JSONObject;
import android.content.SharedPreferences;
import android.widget.Toast;
import org.mozilla.gecko.preferences.GeckoPreferences;
/**
 * A page in about:home that displays a ListView of bookmarks.
 */
public class BookmarksPanel extends HomeFragment {
    public static final String LOGTAG = "GeckoBookmarksPanel";

    // Cursor loader ID for list of bookmarks.
    private static final int LOADER_ID_BOOKMARKS_LIST = 0;

    // Information about the target bookmarks folder.
    private static final String BOOKMARKS_FOLDER_INFO = "folder_info";

    // Refresh type for folder refreshing loader.
    private static final String BOOKMARKS_REFRESH_TYPE = "refresh_type";

    // List of bookmarks.
    private BookmarksListView mList;
    private Button mButtonMP; // Privafox 

    // Adapter for list of bookmarks.
    private BookmarksListAdapter mListAdapter;

    // Adapter's parent stack.
    private List<FolderInfo> mSavedParentStack;

    // Reference to the View to display when there are no results.
    private View mEmptyView;

    // Callback for cursor loaders.
    private CursorLoaderCallbacks mLoaderCallbacks;
   // Privafox :  pref Privacy
    private static final String PREFS_MP_ENABLED = "privacy.masterpassword.enabled";
    private static final String PREFS_PROTECT_BOOKMARK = "security.additionalSecurity.protectBookmark";
    private static final String PREFS_PROTECT_BOOKMARK_IS_LOGIN = "security.additionalSecurity.protectBookmark.isAlreadyLogin";

    private boolean isWaitingSendLogin = false;
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        final View view = inflater.inflate(R.layout.home_bookmarks_panel, container, false);
       // Privafox :  setup button enter master password
        mButtonMP = (Button) view.findViewById(R.id.button_mp);
        EventDispatcher.getInstance().registerGeckoThreadListener((NativeEventListener) this,
                "BookmarksPanel:showBookmark");

        mButtonMP.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                // Private request Login MP for show bookmark
                if(!isWaitingSendLogin) {
                    isWaitingSendLogin = true;
                    GeckoEvent eventRequestLogin = GeckoEvent.createBroadcastEvent("BookmarksPanel:EventLoginRequest", null);
                    GeckoAppShell.sendEventToGecko(eventRequestLogin);
                }
            }
        });
        mList = (BookmarksListView) view.findViewById(R.id.bookmarks_list);
        // Privafox : set visibility default
        mList.setVisibility(View.GONE);
        mButtonMP.setVisibility(View.GONE);
        mList.setContextMenuInfoFactory(new HomeContextMenuInfo.Factory() {
            @Override
            public HomeContextMenuInfo makeInfoForCursor(View view, int position, long id, Cursor cursor) {
                final int type = cursor.getInt(cursor.getColumnIndexOrThrow(Bookmarks.TYPE));
                if (type == Bookmarks.TYPE_FOLDER) {
                    // We don't show a context menu for folders
                    return null;
                }
                final HomeContextMenuInfo info = new HomeContextMenuInfo(view, position, id);
                info.url = cursor.getString(cursor.getColumnIndexOrThrow(Bookmarks.URL));
                info.title = cursor.getString(cursor.getColumnIndexOrThrow(Bookmarks.TITLE));
                info.bookmarkId = cursor.getInt(cursor.getColumnIndexOrThrow(Bookmarks._ID));
                info.itemType = RemoveItemType.BOOKMARKS;
                return info;
            }
        });

        return view;
    }
	// Privafox : 
    @Override
    public void handleMessage(final String event, final NativeJSObject message, final EventCallback callback) {
        Log.w(LOGTAG, "Titan BookmarkPanel handling message name: " + event);
        try {
            if (event.equals("BookmarksPanel:showBookmark")) {
                final boolean isProtect = message.getBoolean("isProtected");
                if(message.getString("name").compareToIgnoreCase("responseLoginMasterpassword") == 0){
                    this.isWaitingSendLogin = false;
                    this.setSharedPrefBookmarkLogin(isProtect);
                }else if(message.getString("name").compareToIgnoreCase("requestBookmarkStartup") == 0 ){
                    this.setSharedPrefBookmarkLogin(isProtect);
                }
                org.mozilla.gecko.util.ThreadUtils.postToUiThread(new Runnable() {
                    @Override
                    public void run() {
                        BookmarksPanel.this.showBookmark(isProtect);
                    }
                });
                Log.w(LOGTAG, "Titan BookmarkPanel handling message name: " + event + " isProtect : " + isProtect);
            }
        } catch (Exception e) {
            Log.e(LOGTAG, "Exception BookmarkPanel handling message \"" + event + "\":", e);
        }
    }

    @Override
    public void handleMessage(String event, JSONObject message) {
        Log.w(LOGTAG, "Titan BookmarkPanel handling message name: " + event );
        try{
               //super.handleMessage(event, message);
        } catch (Exception e) {
            Log.e(LOGTAG, "Exception handling message \"" + event + "\":", e);
        }
    }
    // Privafox :  display status bookmark / MasterPassword
    private void showBookmark(boolean enable){
        if (enable) {
            mList.setVisibility(View.GONE);
            mButtonMP.setVisibility(View.VISIBLE);
        } else {
            mList.setVisibility(View.VISIBLE);
            mButtonMP.setVisibility(View.GONE);
        }
    }
	
    @Override
    public void onViewCreated(View view, Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        OnUrlOpenListener listener = null;
        try {
            listener = (OnUrlOpenListener) getActivity();
        } catch (ClassCastException e) {
            throw new ClassCastException(getActivity().toString()
                    + " must implement HomePager.OnUrlOpenListener");
        }

        mList.setTag(HomePager.LIST_TAG_BOOKMARKS);
        mList.setOnUrlOpenListener(listener);

        registerForContextMenu(mList);
    }

    @Override
    public void onActivityCreated(Bundle savedInstanceState) {
        super.onActivityCreated(savedInstanceState);

        final Activity activity = getActivity();
        // Privafox : show status
        final SharedPreferences prefsSecurity = GeckoSharedPrefs.forApp(getActivity());
        boolean isLogin = prefsSecurity.getBoolean(GeckoPreferences.PREF_SHOW_LOGIN, false);
        Log.w(LOGTAG, "Titan onActivityCreated : " + isLogin);
        this.showBookmark(isLogin);
        // Setup the list adapter.
        mListAdapter = new BookmarksListAdapter(activity, null, mSavedParentStack);
        mListAdapter.setOnRefreshFolderListener(new OnRefreshFolderListener() {
            @Override
            public void onRefreshFolder(FolderInfo folderInfo, RefreshType refreshType) {
                // Restart the loader with folder as the argument.
                Bundle bundle = new Bundle();
                bundle.putParcelable(BOOKMARKS_FOLDER_INFO, folderInfo);
                bundle.putParcelable(BOOKMARKS_REFRESH_TYPE, refreshType);
                getLoaderManager().restartLoader(LOADER_ID_BOOKMARKS_LIST, bundle, mLoaderCallbacks);
            }
        });
        mList.setAdapter(mListAdapter);

        // Create callbacks before the initial loader is started.
        mLoaderCallbacks = new CursorLoaderCallbacks();
        loadIfVisible();
    }
   // Privafox : status security bookmark
    private void setSharedPrefBookmarkLogin(boolean enable){
        SharedPreferences prefsSecurity = GeckoSharedPrefs.forApp(getActivity());
        prefsSecurity.edit().putBoolean(GeckoPreferences.PREF_SHOW_LOGIN, enable).apply();
    }
    @Override
    public void onDestroyView() {
      // Privafox : listener Change pref security
        EventDispatcher.getInstance().unregisterGeckoThreadListener((NativeEventListener) this,
                "BookmarksPanel:showBookmark");
        mList = null;
        mListAdapter = null;
        mEmptyView = null;
        super.onDestroyView();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
       // Privafox : Rotation check status security bookmark for display
        final SharedPreferences prefsSecurity = GeckoSharedPrefs.forApp(getActivity());
        boolean isLogin = prefsSecurity.getBoolean(GeckoPreferences.PREF_SHOW_LOGIN, false);
        Log.w(LOGTAG, "BookmarkPanel onConfigurationChanged refresh : " + isLogin);
        this.showBookmark(isLogin);
        super.onConfigurationChanged(newConfig);

        if (isVisible()) {
            // The parent stack is saved just so that the folder state can be
            // restored on rotation.
            mSavedParentStack = mListAdapter.getParentStack();
        }
    }

    @Override
    protected void load() {
        getLoaderManager().initLoader(LOADER_ID_BOOKMARKS_LIST, null, mLoaderCallbacks);
    }

    private void updateUiFromCursor(Cursor c) {
        if ((c == null || c.getCount() == 0) && mEmptyView == null) {
            // Set empty page view. We delay this so that the empty view won't flash.
            final ViewStub emptyViewStub = (ViewStub) getView().findViewById(R.id.home_empty_view_stub);
            mEmptyView = emptyViewStub.inflate();

            final ImageView emptyIcon = (ImageView) mEmptyView.findViewById(R.id.home_empty_image);
            emptyIcon.setImageResource(R.drawable.icon_bookmarks_empty);

            final TextView emptyText = (TextView) mEmptyView.findViewById(R.id.home_empty_text);
            emptyText.setText(R.string.home_bookmarks_empty);

            mList.setEmptyView(mEmptyView);
        }
    }

    /**
     * Loader for the list for bookmarks.
     */
    private static class BookmarksLoader extends SimpleCursorLoader {
        private final FolderInfo mFolderInfo;
        private final RefreshType mRefreshType;
        private final BrowserDB mDB;

        public BookmarksLoader(Context context) {
            this(context,
                 new FolderInfo(Bookmarks.FIXED_ROOT_ID, context.getResources().getString(R.string.bookmarks_title)),
                 RefreshType.CHILD);
        }

        public BookmarksLoader(Context context, FolderInfo folderInfo, RefreshType refreshType) {
            super(context);
            mFolderInfo = folderInfo;
            mRefreshType = refreshType;
            mDB = GeckoProfile.get(context).getDB();
        }

        @Override
        public Cursor loadCursor() {
            return mDB.getBookmarksInFolder(getContext().getContentResolver(), mFolderInfo.id);
        }

        @Override
        public void onContentChanged() {
            // Invalidate the cached value that keeps track of whether or
            // not desktop bookmarks exist.
            mDB.invalidate();
            super.onContentChanged();
        }

        public FolderInfo getFolderInfo() {
            return mFolderInfo;
        }

        public RefreshType getRefreshType() {
            return mRefreshType;
        }
    }

    /**
     * Loader callbacks for the LoaderManager of this fragment.
     */
    private class CursorLoaderCallbacks extends TransitionAwareCursorLoaderCallbacks {
        public boolean isProtectedBookmark = false; // Privafox
        @Override
        public Loader<Cursor> onCreateLoader(int id, Bundle args) {
            if (args == null) {
                return new BookmarksLoader(getActivity());
            } else {
                FolderInfo folderInfo = (FolderInfo) args.getParcelable(BOOKMARKS_FOLDER_INFO);
                RefreshType refreshType = (RefreshType) args.getParcelable(BOOKMARKS_REFRESH_TYPE);
                return new BookmarksLoader(getActivity(), folderInfo, refreshType);
            }
        }

        @Override
        public void onLoadFinishedAfterTransitions(Loader<Cursor> loader, Cursor c) {
            BookmarksLoader bl = (BookmarksLoader) loader;
            mListAdapter.swapCursor(c, bl.getFolderInfo(), bl.getRefreshType());
            updateUiFromCursor(c);
        }

        @Override
        public void onLoaderReset(Loader<Cursor> loader) {
            super.onLoaderReset(loader);
            BookmarksLoader bl = (BookmarksLoader) loader; // Privafox
            if (mList != null) {
                mListAdapter.swapCursor(null);
            }
        }
    }
}
