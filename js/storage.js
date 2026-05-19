// js/storage.js
// A simple localStorage wrapper with an async interface to allow easy migration to IndexedDB later.

const STORAGE_PREFIX = 'taskPWA_';

export async function get(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(STORAGE_PREFIX + key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error('Error reading from localStorage', e);
        return defaultValue;
    }
}

export async function set(key, value) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('Error saving to localStorage', e);
        // QuotaExceededError on most browsers, code 22 (or 1014 on Firefox)
        const isQuota = e && (e.name === 'QuotaExceededError'
            || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            || e.code === 22 || e.code === 1014);
        window.dispatchEvent(new CustomEvent('storage-error', {
            detail: { key, error: e, isQuota }
        }));
        return false;
    }
}
