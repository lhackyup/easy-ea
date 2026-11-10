/**
 * EasyEA Draw.io Web Integration Manager
 * 
 * Handles launching and bidirectional synchronization with Draw.io Web
 * in an external tab or popup window, supporting both:
 * 1. Self-hosted Local Draw.io Web (Docker container at http://localhost:8080)
 * 2. Official Cloud diagrams.net (https://embed.diagrams.net)
 * 3. Custom internal enterprise Draw.io URL
 * 
 * Enforces multi-layered cache invalidation:
 * - Anti-cache URL query parameters (_cb, timestamp)
 * - Stealth mode (stealth=1) to prevent diagrams.net cloud & telemetry storage
 * - Local storage isolation (local=1) to prevent lingering drafts and stale caches
 * - Real-time sync disabling (sync=none) to avoid colliding local sessions
 * - Service Worker bypass (pwa=0, offline=0)
 * - Cookie-based version tracking (easyea_schema_ver_<id>, easyea_cache_bust)
 * - Explicit fresh XML injection via HTML5 postMessage ('load' action)
 */

import { buildDrawioArchimateLibrary, buildDrawioCatalogLibrary, CatalogElementItem } from './archimatePalette';

export const DEFAULT_LOCAL_DRAWIO_URL = 'http://localhost:8080';
export const DEFAULT_CLOUD_DRAWIO_URL = 'https://embed.diagrams.net';

const STORAGE_MODE_KEY = 'easyea_drawio_mode'; // 'local' | 'cloud' | 'custom'
const STORAGE_CUSTOM_URL_KEY = 'easyea_drawio_custom_url';

export type DrawioServerMode = 'local' | 'cloud' | 'custom';

/**
 * Returns the currently active Draw.io server mode.
 */
export function getDrawioMode(): DrawioServerMode {
  try {
    const saved = localStorage.getItem(STORAGE_MODE_KEY);
    if (saved === 'cloud' || saved === 'custom' || saved === 'local') {
      return saved as DrawioServerMode;
    }
  } catch (e) {}
  return 'local';
}

/**
 * Sets the Draw.io server mode ('local', 'cloud', 'custom') and optional custom URL.
 */
export function setDrawioMode(mode: DrawioServerMode, customUrl?: string): void {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
    if (customUrl) {
      localStorage.setItem(STORAGE_CUSTOM_URL_KEY, customUrl.trim().replace(/\/+$/, ''));
    }
  } catch (e) {}
}

/**
 * Returns the base URL of the active Draw.io Web instance.
 */
export function getDrawioBaseUrl(): string {
  const mode = getDrawioMode();
  if (mode === 'cloud') {
    return DEFAULT_CLOUD_DRAWIO_URL;
  }
  if (mode === 'custom') {
    const custom = localStorage.getItem(STORAGE_CUSTOM_URL_KEY);
    if (custom) return custom;
  }
  return DEFAULT_LOCAL_DRAWIO_URL;
}

/**
 * Quick ping to check if the local Draw.io container is running and accessible.
 */
export async function checkDrawioLocalHealth(targetUrl: string = DEFAULT_LOCAL_DRAWIO_URL): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    await fetch(targetUrl, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return true;
  } catch (e) {
    return false;
  }
}

export interface DrawioSessionOptions {
  schemaId: string;
  schemaName: string;
  modelId?: string;
  version?: string;
  initialXml: string;
  readonly?: boolean;
  serverUrl?: string;
  authToken?: string;
  username?: string;
  fullName?: string;
  catalogElements?: CatalogElementItem[];
  onSave?: (xml: string) => Promise<void> | void;
  onClose?: () => void;
  onStatusChange?: (status: 'loading' | 'ready' | 'saving' | 'saved' | 'closed') => void;
}

/**
 * Sets client-side cache invalidation cookies to prevent stale browser caching.
 */
export function setCacheInvalidationCookies(schemaId: string, version?: string): void {
  try {
    const ts = Date.now();
    const ver = version || `v${ts}`;
    document.cookie = `easyea_schema_ver_${schemaId}=${ver}_${ts}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `easyea_cache_bust=${ts}; path=/; max-age=86400; SameSite=Lax`;
  } catch (e) {
    console.warn('[DrawioWebManager] Failed to set cache invalidation cookies:', e);
  }
}

/**
 * Builds the Draw.io Web URL with all cache-invalidation and UI parameters.
 */
export function buildDrawioWebUrl(options?: { title?: string; readonly?: boolean; serverUrl?: string }): string {
  const timestamp = Date.now();
  const baseUrl = (options?.serverUrl || getDrawioBaseUrl()).replace(/\/+$/, '');
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    spin: '1',
    configure: '1',
    libraries: '1',
    libs: 'archimate3',
    // Plugin integration (loads EasyEA menu in Draw.io Web)
    p: 'easyea',
    // Cache invalidation & isolation flags:
    stealth: '1',       // No external storage, no Google Drive/Dropbox sync, no telemetry
    local: '1',         // Disable local storage / lingering draft restoration
    sync: 'none',       // Disable collaborative sync and cache merging
    pwa: '0',           // Disable PWA / Service Worker caching
    offline: '0',       // Bypass offline mode
    saveAndExit: '0',   // Don't close immediately on save
    noSaveBtn: options?.readonly ? '1' : '0',
    noExitBtn: '0',
    _cb: String(timestamp), // Cache buster param
  });

  if (options?.title) {
    params.set('title', options.title);
  }

  return `${baseUrl}/?${params.toString()}`;
}

/**
 * Active Draw.io Web Session Controller (Supports Local & Cloud instances)
 */
export class DrawioWebSession {
  private options: DrawioSessionOptions;
  private windowRef: Window | null = null;
  private checkClosedInterval: any = null;
  private isConfigured = false;
  private isLoaded = false;
  private currentXml: string;
  private isDestroyed = false;
  private targetOrigin: string = '*';

  constructor(options: DrawioSessionOptions) {
    this.options = options;
    this.currentXml = options.initialXml;
  }

  /**
   * Opens Draw.io Web in a new tab or window and begins listening for postMessage events.
   */
  public open(): Window | null {
    if (this.windowRef && !this.windowRef.closed) {
      this.windowRef.focus();
      return this.windowRef;
    }

    // 1. Invalidate cookies before opening
    setCacheInvalidationCookies(this.options.schemaId, this.options.version);

    // 2. Build URL with cache busting
    const url = buildDrawioWebUrl({
      title: this.options.schemaName,
      readonly: this.options.readonly,
      serverUrl: this.options.serverUrl
    });

    try {
      this.targetOrigin = new URL(url).origin;
    } catch (e) {
      this.targetOrigin = '*';
    }

    // 3. Unique window target name to prevent browser browsing-context cache reuse
    const windowTarget = `easyea_drawio_${this.options.schemaId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
    
    // Calculate centered window popup dimensions
    const width = Math.min(window.screen.availWidth - 100, 1440);
    const height = Math.min(window.screen.availHeight - 100, 900);
    const left = Math.max(0, Math.floor((window.screen.availWidth - width) / 2));
    const top = Math.max(0, Math.floor((window.screen.availHeight - height) / 2));

    const windowFeatures = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`;

    this.options.onStatusChange?.('loading');

    // 4. Open popup or new tab
    this.windowRef = window.open(url, windowTarget, windowFeatures);

    if (!this.windowRef) {
      console.error('[DrawioWebManager] Popup was blocked by browser.');
      return null;
    }

    // 5. Attach message listener
    window.addEventListener('message', this.handleMessage);

    // 6. Monitor window closure
    this.checkClosedInterval = setInterval(() => {
      if (this.windowRef && this.windowRef.closed) {
        this.cleanup();
      }
    }, 1000);

    return this.windowRef;
  }

  /**
   * Message dispatcher for Draw.io HTML5 postMessage protocol
   */
  private handleMessage = async (event: MessageEvent) => {
    // Validate Origin: Accept messages from targetOrigin or known Draw.io hosts
    const allowedOrigins = [
      this.targetOrigin,
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'https://embed.diagrams.net',
      'https://app.diagrams.net'
    ];
    if (this.targetOrigin !== '*' && !allowedOrigins.includes(event.origin)) {
      return;
    }

    if (this.windowRef && event.source !== this.windowRef) return;
    if (typeof event.data !== 'string') return;

    try {
      const msg = JSON.parse(event.data);
      const postOrigin = this.targetOrigin || '*';

      // Event 1: Configure - Inject ArchiMate 3.x Palette & Workspace Catalog
      if (msg.event === 'configure') {
        this.isConfigured = true;
        const archimateLibs = buildDrawioArchimateLibrary();
        
        const customEntriesList: any[] = [];

        // 1. If catalog elements exist, inject them in the primary top library
        if (this.options.catalogElements && this.options.catalogElements.length > 0) {
          const catalogEntries = buildDrawioCatalogLibrary(this.options.catalogElements);
          if (catalogEntries.length > 0) {
            customEntriesList.push({
              id: 'easyea_catalog',
              libs: [
                {
                  title: `🏛️ EasyEA Catalogo (${catalogEntries.length} elementi)`,
                  expand: true,
                  data: catalogEntries
                }
              ]
            });
          }
        }

        // 2. Add ArchiMate 3.x Standard Palette
        customEntriesList.push({
          id: 'easyea_archimate',
          libs: [
            {
              title: '📐 EasyEA ArchiMate 3.x (Forme Standard)',
              expand: true,
              data: archimateLibs
            }
          ]
        });

        this.windowRef?.postMessage(
          JSON.stringify({
            action: 'configure',
            config: {
              defaultLibraries: 'archimate3;general',
              enabledLibraries: ['archimate3', 'general'],
              expandLibraries: true,
              appendCustomLibraries: false,
              libraries: [
                {
                  entries: customEntriesList
                }
              ]
            }
          }),
          postOrigin
        );
      }

      // Event 2: Init - Send fresh XML diagram data
      if (msg.event === 'init') {
        this.isLoaded = true;
        this.options.onStatusChange?.('ready');

        // Deliver active user session & auth token to the EasyEA plugin running inside Draw.io Web
        if (this.options.authToken) {
          const serverUrl = window.location.origin;
          this.windowRef?.postMessage(
            JSON.stringify({
              action: 'easyeaAuthSession',
              config: {
                server_url: serverUrl,
                token: this.options.authToken,
                username: this.options.username || 'admin',
                full_name: this.options.fullName || 'Utente EasyEA'
              },
              active_schema: {
                schema_id: this.options.schemaId,
                schema_name: this.options.schemaName,
                model_id: this.options.modelId || '',
                current_version: this.options.version || 'v1.0'
              }
            }),
            postOrigin
          );
        }

        this.windowRef?.postMessage(
          JSON.stringify({
            action: 'load',
            autosave: 1,
            xml: this.currentXml,
            title: this.options.schemaName || 'EasyEA Architecture Schema'
          }),
          postOrigin
        );
      }

      // Event 3: Save - User clicked Save or autosave triggered
      if (msg.event === 'save') {
        const xml = msg.xml;
        if (xml) {
          this.currentXml = xml;
          this.options.onStatusChange?.('saving');

          // Send immediate visual status confirmation to Draw.io canvas
          this.windowRef?.postMessage(
            JSON.stringify({
              action: 'status',
              message: 'Sincronizzazione con EasyEA in corso...',
              modified: false
            }),
            postOrigin
          );

          if (this.options.onSave) {
            try {
              await this.options.onSave(xml);
              this.options.onStatusChange?.('saved');

              // Update cache invalidation cookies with fresh timestamp
              setCacheInvalidationCookies(this.options.schemaId, this.options.version);

              // Notify Draw.io that save completed
              this.windowRef?.postMessage(
                JSON.stringify({
                  action: 'status',
                  message: 'Salvato con successo in EasyEA!',
                  modified: false
                }),
                postOrigin
              );
            } catch (err: any) {
              console.error('[DrawioWebManager] Save error:', err);
              this.windowRef?.postMessage(
                JSON.stringify({
                  action: 'prompt',
                  title: 'Errore di Salvataggio EasyEA',
                  message: err.message || 'Errore durante la registrazione su EasyEA'
                }),
                postOrigin
              );
            }
          }
        }
      }

      // Event 4: Exit - User clicked Exit
      if (msg.event === 'exit') {
        this.close();
      }
    } catch (e) {
      // Non-JSON or irrelevant message
    }
  };

  /**
   * Updates the current XML held by the session (e.g. if refreshed from server).
   */
  public updateXml(newXml: string): void {
    this.currentXml = newXml;
    if (this.isLoaded && this.windowRef && !this.windowRef.closed) {
      const postOrigin = this.targetOrigin || '*';
      this.windowRef.postMessage(
        JSON.stringify({
          action: 'load',
          autosave: 1,
          xml: newXml,
          title: this.options.schemaName
        }),
        postOrigin
      );
    }
  }

  /**
   * Closes the session and the external window.
   */
  public close(): void {
    if (this.windowRef && !this.windowRef.closed) {
      this.windowRef.close();
    }
    this.cleanup();
  }

  /**
   * Internal cleanup of event listeners and timers.
   */
  private cleanup(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.checkClosedInterval) {
      clearInterval(this.checkClosedInterval);
      this.checkClosedInterval = null;
    }

    window.removeEventListener('message', this.handleMessage);
    this.options.onStatusChange?.('closed');
    this.options.onClose?.();
  }
}

/**
 * Helper to open Draw.io Web directly with full cache invalidation.
 */
export function openDrawioWeb(options: DrawioSessionOptions): DrawioWebSession {
  const session = new DrawioWebSession(options);
  session.open();
  return session;
}
