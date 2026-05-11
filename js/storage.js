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
    } catch (e) {
        console.error('Error saving to localStorage', e);
    }
}
