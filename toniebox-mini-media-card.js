/*
 * Toniebox Mini Media Card
 * A compact Lovelace card for Toniebox MQTT entities.
 *
 * Usage (Lovelace YAML):
 *
 * resources:
 *   - url: /hacsfiles/toniebox-mini-media-card/toniebox-mini-media-card.js
 *     type: module
 *
 * type: custom:toniebox-mini-media-card
 * entity: media_player.toniebox
 * last_title_entity: sensor.toniebox_last_title
 * last_cover_entity: sensor.toniebox_last_cover_url
 * charging_entity: binary_sensor.toniebox_charging
 * battery_entity: sensor.toniebox_battery
 * rssi_entity: sensor.toniebox_wifi_rssi
 * show_last_title: true
 * show_battery: true
 * show_rssi: false
 *
 * Repository structure for HACS (Frontend):
 * - /toniebox-mini-media-card/
 *   - toniebox-mini-media-card.js (this file)
 *   - hacs.json
 *   - README.md
 *   - LICENSE (optional)
 */

class TonieboxMiniMediaCard extends HTMLElement {
  static getConfigElement() {
    return null;
  }
  static getStubConfig() {
    return {
      entity: "media_player.toniebox",
      show_last_title: true,
      show_battery: true,
      show_rssi: false,
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("Required property 'entity' is missing (media_player.*)");
    }
    this._config = {
      name: config.name || "Toniebox",
      entity: config.entity,
      last_title_entity: config.last_title_entity,
      last_cover_entity: config.last_cover_entity,
      charging_entity: config.charging_entity,
      battery_entity: config.battery_entity,
      rssi_entity: config.rssi_entity,
      show_last_title: config.show_last_title !== false,
      show_battery: config.show_battery !== false,
      show_rssi: !!config.show_rssi,
      tap_action: config.tap_action || { action: "more-info" },
    };

    this._card = document.createElement("ha-card");
    this._card.className = "toniebox-mini-media-card";
    this._content = document.createElement("div");
    this._content.className = "tbx-wrap";
    this._card.appendChild(this._content);

    const style = document.createElement("style");
    style.textContent = `
      .toniebox-mini-media-card {
        --tbx-gap: 12px;
        --tbx-radius: 16px;
        --tbx-pad: 12px;
      }
      .tbx-wrap {
        display: grid;
        grid-template-columns: 56px 1fr auto;
        align-items: center;
        gap: var(--tbx-gap);
        padding: var(--tbx-pad);
      }
      .tbx-cover {
        width: 56px; height: 56px; border-radius: var(--tbx-radius);
        overflow: hidden; background: var(--secondary-background-color);
        display: grid; place-items: center; border: 1px solid var(--divider-color);
      }
      .tbx-cover img { width: 100%; height: 100%; object-fit: cover; display:block; }
      .tbx-main { display: grid; gap: 4px; min-width: 0; }
      .tbx-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tbx-sub { color: var(--secondary-text-color); font-size: 0.9em; display:flex; gap:10px; align-items:center; }
      .tbx-chip { display:inline-flex; gap:6px; align-items:center; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--divider-color); }
      .tbx-right { display:flex; gap:8px; align-items:center; }
      mwc-icon-button { --mdc-icon-button-size: 40px; }
      ha-state-icon.tbx-charge { color: var(--state-icon-active-color); }
      .dot { width:8px; height:8px; border-radius:50%; background: var(--primary-color); display:inline-block; }
      .muted { color: var(--disabled-text-color); }
    `;
    this._card.appendChild(style);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._card) return;
    this._render();
  }

  getCardSize() {
    return 2;
  }

  _entityState(entityId) {
    if (!entityId) return null;
    return this._hass?.states?.[entityId] || null;
  }

  _render() {
    const c = this._config;
    const mp = this._entityState(c.entity);
    const charging = this._entityState(c.charging_entity);
    const battery = this._entityState(c.battery_entity);
    const rssi = this._entityState(c.rssi_entity);

    const lastTitle = this._entityState(c.last_title_entity)?.state;
    const coverUrl = this._entityState(c.last_cover_entity)?.state;

    const state = mp?.state || "unavailable";
    const mediaTitle = mp?.attributes?.media_title || null;
    const sourceTitle = mediaTitle || lastTitle || "—";

    const isPlaying = state === "playing";
    const isPaused = state === "paused";
    const isIdle = state === "idle" || state === "off" || state === "standby";
    const isCharging =
      charging?.state === "on" || battery?.attributes?.charging === true;

    const batteryPct =
      battery && !isNaN(parseFloat(battery.state))
        ? `${Math.round(parseFloat(battery.state))}%`
        : null;
    const rssiVal =
      rssi && !isNaN(parseFloat(rssi.state))
        ? `${Math.round(parseFloat(rssi.state))} dBm`
        : null;

    // Right-side controls
    const playPauseIcon = isPlaying ? "mdi:pause" : "mdi:play";

    this._content.innerHTML = `
      <div class="tbx-cover">
        ${
          coverUrl && coverUrl !== "unknown"
            ? `<img src="${coverUrl}" alt="cover"/>`
            : `<ha-state-icon .hass="${null}" icon="mdi:cube-outline"></ha-state-icon>`
        }
      </div>
      <div class="tbx-main">
        <div class="tbx-title">${this._escape(sourceTitle)}</div>
        <div class="tbx-sub">
          <span class="tbx-chip">
            <ha-state-icon .hass="${null}" icon="mdi:music"></ha-state-icon>
            <span>${state}</span>
          </span>
          ${
            c.show_battery && batteryPct
              ? `<span class="tbx-chip"><ha-state-icon .hass="${null}" icon="mdi:battery"></ha-state-icon><span>${batteryPct}</span></span>`
              : ""
          }
          ${
            isCharging
              ? `<ha-state-icon class="tbx-charge" .hass="${null}" icon="mdi:lightning-bolt"></ha-state-icon>`
              : ""
          }
          ${
            c.show_rssi && rssiVal
              ? `<span class="muted">${rssiVal}</span>`
              : ""
          }
        </div>
      </div>
      <div class="tbx-right">
        <mwc-icon-button aria-label="prev" title="Vorheriger Track">
          <ha-icon icon="mdi:skip-previous"></ha-icon>
        </mwc-icon-button>
        <mwc-icon-button aria-label="play-pause" title="Play/Pause">
          <ha-icon icon="${playPauseIcon}"></ha-icon>
        </mwc-icon-button>
        <mwc-icon-button aria-label="next" title="Nächster Track">
          <ha-icon icon="mdi:skip-next"></ha-icon>
        </mwc-icon-button>
      </div>
    `;

    // Wire actions
    const [prevBtn, playBtn, nextBtn] =
      this._content.querySelectorAll("mwc-icon-button");
    if (prevBtn) prevBtn.onclick = () => this._call("media_previous_track");
    if (playBtn) playBtn.onclick = () => this._call("media_play_pause");
    if (nextBtn) nextBtn.onclick = () => this._call("media_next_track");

    // Tap on card → more-info (default) or custom
    this._card.onclick = (ev) => {
      if (ev.composedPath().some((el) => el.tagName === "MWC-ICON-BUTTON"))
        return; // ignore button clicks
      const action = c.tap_action?.action || "more-info";
      if (action === "more-info") {
        this._fire("hass-more-info", { entityId: c.entity });
      } else if (action === "call-service") {
        const { service, service_data } = c.tap_action;
        if (service) {
          const [domain, srv] = service.split(".");
          this._hass.callService(domain, srv, service_data || {});
        }
      }
    };
  }

  _escape(text) {
    return (text || "")
      .toString()
      .replace(
        /[&<>"]/g,
        (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[s])
      );
  }

  _call(service) {
    const entity_id = this._config.entity;
    this._hass.callService("media_player", service, { entity_id });
  }

  _fire(type, detail, options) {
    const event = new Event(type, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });
    event.detail = detail || {};
    this.dispatchEvent(event);
    return event;
  }

  set _hass(hass) {
    this.__hass = hass;
  }
  get _hass() {
    return this.__hass;
  }

  // Required by HA to register the card in the UI
  static get properties() {
    return {};
  }
}

customElements.define("toniebox-mini-media-card", TonieboxMiniMediaCard);

// Provide card description in Lovelace card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: "toniebox-mini-media-card",
  name: "Toniebox Mini Media Card",
  description:
    "Kompakte Media-Card für Toniebox (MQTT). Zeigt Cover, Titel, Status, Akku & Laden).",
});
