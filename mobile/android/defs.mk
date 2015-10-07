MOZ_ANDROID_SHARED_ID = $(ANDROID_PACKAGE_NAME).sharedID
# Android Sync Account types are not per-package: release and beta
# share an Account type, and aurora and nightly share an Account type.
MOZ_ANDROID_SHARED_ACCOUNT_TYPE = $(ANDROID_PACKAGE_NAME)_sync
# Firefox Accounts Account types are per-package.
MOZ_ANDROID_SHARED_FXACCOUNT_TYPE = $(ANDROID_PACKAGE_NAME)_fxaccount

# We released these builds to the public with shared IDs and need to
# keep them consistent.
ifeq (com.privacore.privafox,$(ANDROID_PACKAGE_NAME))
MOZ_ANDROID_SHARED_ID = com.privacore.privafox.sharedID
MOZ_ANDROID_SHARED_ACCOUNT_TYPE = com.privacore.privafox_sync
else ifeq (com.privacore.privafox_beta,$(ANDROID_PACKAGE_NAME))
MOZ_ANDROID_SHARED_ID = com.privacore.privafox.sharedID
MOZ_ANDROID_SHARED_ACCOUNT_TYPE = com.privacore.privafox_sync
else ifeq (org.mozilla.fennec_aurora,$(ANDROID_PACKAGE_NAME))
MOZ_ANDROID_SHARED_ID = org.mozilla.fennec.sharedID
MOZ_ANDROID_SHARED_ACCOUNT_TYPE = org.mozilla.fennec_sync
else ifeq (org.mozilla.fennec,$(ANDROID_PACKAGE_NAME))
MOZ_ANDROID_SHARED_ID = org.mozilla.fennec.sharedID
MOZ_ANDROID_SHARED_ACCOUNT_TYPE = org.mozilla.fennec_sync
endif
