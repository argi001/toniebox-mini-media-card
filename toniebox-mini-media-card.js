/*
 * Toniebox Mini Media Card – with built‑in GUI editor
 * A compact Lovelace card for Toniebox MQTT entities – pick everything via UI (no YAML needed).
 *
 * HACS resource URL:
 *   /hacsfiles/toniebox-mini-media-card/toniebox-mini-media-card.js
 *
 * Minimal usage (YAML still supported):
 *   type: custom:toniebox-mini-media-card
 *
 * Then use the card's visual editor to select entities & control mode.
 */

class TonieboxMiniMediaCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("toniebox-mini-media-card-editor");
  }

  static getStubConfig(hass) {
    // Try to suggest a media_player if one exists
    const anyMp = Object.keys(hass.states || {}).find((id) =>
      id.startsWith("media_player.")
    );
    return {
      name: "Toniebox",
      control: anyMp
        ? { mode: "media_player", media_player: anyMp }
        : { mode: "mqtt" },
      entities: {
        title_entity: "",
        cover_entity: "",
        playback_entity: "",
        battery_entity: "",
        charging_entity: "",
        rssi_entity: "",
      },
      show_battery: true,
      show_rssi: false,
    };
  }

  setConfig(config) {
    // Backwards compatibility with older config shape
    const legacy = {
      media_player: config.entity,
      title_entity: config.last_title_entity || config.title_entity,
      cover_entity: config.last_cover_entity || config.cover_entity,
      charging_entity: config.charging_entity,
      battery_entity: config.battery_entity,
      rssi_entity: config.rssi_entity,
    };

    const entities = config.entities || {
      title_entity: legacy.title_entity || "",
      cover_entity: legacy.cover_entity || "",
      playback_entity: config.playback_entity || "",
      battery_entity: legacy.battery_entity || "",
      charging_entity: legacy.charging_entity || "",
      rssi_entity: legacy.rssi_entity || "",
    };

    const control =
      config.control ||
      (legacy.media_player
        ? { mode: "media_player", media_player: legacy.media_player }
        : {
            mode: "mqtt",
            mqtt: {
              command_topic: "",
              play_payload: "PLAY",
              pause_payload: "PAUSE",
              next_payload: "NEXT",
              previous_payload: "PREVIOUS",
              volume_up_payload: "VOL_UP",
              volume_down_payload: "VOL_DOWN",
            },
          });

    this._config = {
      name: config.name || "Toniebox",
      entities,
      control,
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
      .toniebox-mini-media-card { --tbx-gap: 12px; --tbx-radius: 16px; --tbx-pad: 12px; }
      .tbx-wrap { display: grid; grid-template-columns: 56px 1fr auto; align-items: center; gap: var(--tbx-gap); padding: var(--tbx-pad); }
      .tbx-cover { width: 56px; height: 56px; border-radius: var(--tbx-radius); overflow: hidden; background: var(--secondary-background-color); display: grid; place-items: center; border: 1px solid var(--divider-color); }
      .tbx-cover img { width: 100%; height: 100%; object-fit: cover; display:block; }
      .tbx-main { display: grid; gap: 4px; min-width: 0; }
      .tbx-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tbx-sub { color: var(--secondary-text-color); font-size: 0.9em; display:flex; gap:10px; align-items:center; }
      .tbx-chip { display:inline-flex; gap:6px; align-items:center; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--divider-color); }
      .tbx-right { display:flex; gap:8px; align-items:center; }
      mwc-icon-button { --mdc-icon-button-size: 40px; }
      ha-state-icon.tbx-charge { color: var(--state-icon-active-color); }
      .muted { color: var(--disabled-text-color); }
    `;
    this._card.appendChild(style);
  }

  set hass(hass) {
    this.__hass = hass;
    if (this._card) this._render();
  }
  get hass() {
    return this.__hass;
  }

  getCardSize() {
    return 2;
  }

  _entityState(entityId) {
    if (!entityId) return null;
    return this.hass?.states?.[entityId] || null;
  }

  _render() {
    const c = this._config || {};
    const e = c.entities || {};
    const h = this.hass;

    // Resolve pieces
    const mpId =
      c.control?.mode === "media_player" ? c.control?.media_player : null;
    const mp = this._entityState(mpId);

    const stateFromMp = mp?.state || null;
    const stateFromPlayback =
      this._entityState(e.playback_entity)?.state || null;
    const state = (
      stateFromPlayback ||
      stateFromMp ||
      "unavailable"
    ).toLowerCase();

    const mediaTitle = mp?.attributes?.media_title || null;
    const title = this._entityState(e.title_entity)?.state || null;
    const sourceTitle = mediaTitle || title || "—";

    const coverFromMp =
      mp?.attributes?.entity_picture ||
      mp?.attributes?.entity_picture_local ||
      null;
    const coverFromSensor = this._entityState(e.cover_entity)?.state || null;
    const coverUrl = coverFromSensor || coverFromMp;

    const battery = this._entityState(e.battery_entity);
    const charging = this._entityState(e.charging_entity);
    const rssi = this._entityState(e.rssi_entity);

    const isPlaying = state === "playing" || state === "play";
    const isPaused = state === "paused";
    const isIdle = ["idle", "standby", "off"].includes(state);
    const isCharging =
      (charging?.state || "").toLowerCase() === "on" ||
      battery?.attributes?.charging === true;

    const batteryPct =
      battery && !isNaN(parseFloat(battery.state))
        ? `${Math.round(parseFloat(battery.state))}%`
        : null;
    const rssiVal =
      rssi && !isNaN(parseFloat(rssi.state))
        ? `${Math.round(parseFloat(rssi.state))} dBm`
        : null;

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
        <mwc-icon-button aria-label="prev" title="Vorheriger Track"><ha-icon icon="mdi:skip-previous"></ha-icon></mwc-icon-button>
        <mwc-icon-button aria-label="play-pause" title="Play/Pause"><ha-icon icon="${playPauseIcon}"></ha-icon></mwc-icon-button>
        <mwc-icon-button aria-label="next" title="Nächster Track"><ha-icon icon="mdi:skip-next"></ha-icon></mwc-icon-button>
      </div>`;

    const [prevBtn, playBtn, nextBtn] =
      this._content.querySelectorAll("mwc-icon-button");
    if (prevBtn) prevBtn.onclick = () => this._handleAction("previous");
    if (playBtn)
      playBtn.onclick = () => this._handleAction(isPlaying ? "pause" : "play");
    if (nextBtn) nextBtn.onclick = () => this._handleAction("next");

    // Tap on card → more-info (default) or custom
    this._card.onclick = (ev) => {
      if (ev.composedPath().some((el) => el.tagName === "MWC-ICON-BUTTON"))
        return; // ignore button clicks
      const action = c.tap_action?.action || "more-info";
      if (action === "more-info") {
        this._fire("hass-more-info", {
          entityId: mpId || e.title_entity || e.playback_entity,
        });
      } else if (action === "call-service") {
        const { service, service_data } = c.tap_action;
        if (service) {
          const [domain, srv] = service.split(".");
          this.hass.callService(domain, srv, service_data || {});
        }
      }
    };
  }

  _escape(text) {
    return (text || "")
      .toString()
      .replace(
        /[&<>\"]/g,
        (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[s])
      );
  }

  async _handleAction(kind) {
    const c = this._config;
    const mode = c.control?.mode || "media_player";

    if (mode === "media_player") {
      const entity_id = c.control?.media_player;
      if (!entity_id) return;
      const map = {
        play: "media_play",
        pause: "media_pause",
        next: "media_next_track",
        previous: "media_previous_track",
      };
      const srv = map[kind];
      if (!srv) return;
      await this.hass.callService("media_player", srv, { entity_id });
      return;
    }

    if (mode === "mqtt") {
      const cfg = c.control?.mqtt || {};
      const topic = cfg.command_topic;
      if (!topic) return;
      const payload = {
        play: cfg.play_payload || "PLAY",
        pause: cfg.pause_payload || "PAUSE",
        next: cfg.next_payload || "NEXT",
        previous: cfg.previous_payload || "PREVIOUS",
      }[kind];
      if (!payload) return;
      await this.hass.callService("mqtt", "publish", {
        topic,
        payload,
        qos: 0,
        retain: false,
      });
      return;
    }
  }

  _fire(type, detail) {
    const event = new Event(type, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });
    event.detail = detail || {};
    this.dispatchEvent(event);
    return event;
  }

  getCardSize() {
    return 2;
  }

  set _hass(hass) {
    this.__hass = hass;
  }
  get _hass() {
    return this.__hass;
  }

  // Attach card element to DOM
  connectedCallback() {
    if (!this.contains(this._card)) this.appendChild(this._card);
  }
}

customElements.define("toniebox-mini-media-card", TonieboxMiniMediaCard);

// ----------------- GUI EDITOR -----------------
class TonieboxMiniMediaCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._root) this._attachPickers();
  }

  _render() {
    if (!this._root) {
      this._root = document.createElement("div");
      this._root.style.padding = "8px 16px 16px";
      this.appendChild(this._root);
    }

    const c = this._ensureShape(this._config);

    this._root.innerHTML = `
      <style>
        .row { display:grid; grid-template-columns: 180px 1fr; align-items:center; gap:12px; margin:8px 0; }
        .group { border-top: 1px solid var(--divider-color); margin-top: 12px; padding-top: 12px; }
        .hint { color: var(--secondary-text-color); font-size: 0.9em; }
      </style>

      <div class="row">
        <label>Name</label>
        <ha-textfield class="i-name" value="${
          c.name || ""
        }" placeholder="Toniebox"></ha-textfield>
      </div>

      <div class="row">
        <label>Control mode</label>
        <ha-select class="i-mode" .value="${c.control.mode}">
          <mwc-list-item value="media_player">media_player services</mwc-list-item>
          <mwc-list-item value="mqtt">MQTT (topic + payloads)</mwc-list-item>
        </ha-select>
      </div>

      <div class="row group g-mp" style="display:${
        c.control.mode === "media_player" ? "grid" : "none"
      }">
        <label>Media player</label>
        <ha-entity-picker class="i-mp" .hass="${null}" .value="${
      c.control.media_player || ""
    }"></ha-entity-picker>
      </div>

      <div class="group g-mqtt" style="display:${
        c.control.mode === "mqtt" ? "block" : "none"
      }">
        <div class="row"><label>Command topic</label><ha-textfield class="i-topic" value="${
          c.control.mqtt.command_topic || ""
        }" placeholder="teddycloud/milas/cmnd"></ha-textfield></div>
        <div class="row"><label>Play payload</label><ha-textfield class="i-pl" value="${
          c.control.mqtt.play_payload || "PLAY"
        }"></ha-textfield></div>
        <div class="row"><label>Pause payload</label><ha-textfield class="i-pp" value="${
          c.control.mqtt.pause_payload || "PAUSE"
        }"></ha-textfield></div>
        <div class="row"><label>Next payload</label><ha-textfield class="i-nx" value="${
          c.control.mqtt.next_payload || "NEXT"
        }"></ha-textfield></div>
        <div class="row"><label>Previous payload</label><ha-textfield class="i-pr" value="${
          c.control.mqtt.previous_payload || "PREVIOUS"
        }"></ha-textfield></div>
      </div>

      <div class="group">
        <div class="row"><label>Title entity</label><ha-entity-picker class="i-title" .hass="${null}" .value="${
      c.entities.title_entity || ""
    }"></ha-entity-picker></div>
        <div class="row"><label>Cover entity (URL)</label><ha-entity-picker class="i-cover" .hass="${null}" .value="${
      c.entities.cover_entity || ""
    }"></ha-entity-picker></div>
        <div class="row"><label>Playback entity</label><ha-entity-picker class="i-playback" .hass="${null}" .value="${
      c.entities.playback_entity || ""
    }"></ha-entity-picker></div>
        <div class="row"><label>Battery entity</label><ha-entity-picker class="i-bat" .hass="${null}" .value="${
      c.entities.battery_entity || ""
    }"></ha-entity-picker></div>
        <div class="row"><label>Charging entity</label><ha-entity-picker class="i-chg" .hass="${null}" .value="${
      c.entities.charging_entity || ""
    }"></ha-entity-picker></div>
        <div class="row"><label>Wi‑Fi RSSI</label><ha-entity-picker class="i-rssi" .hass="${null}" .value="${
      c.entities.rssi_entity || ""
    }"></ha-entity-picker></div>
        <div class="row"><label>Show battery</label><ha-switch class="i-showbat" ${
          c.show_battery ? "checked" : ""
        }></ha-switch></div>
        <div class="row"><label>Show RSSI</label><ha-switch class="i-showrssi" ${
          c.show_rssi ? "checked" : ""
        }></ha-switch></div>
      </div>

      <div class="hint">Tipp: Wenn du einen <b>media_player</b> auswählst, kommen Titel/Cover/Status automatisch – die Sensorfelder sind dann optional (Fallback).</div>
    `;

    this._attachPickers();
    this._wire();
  }

  _attachPickers() {
    const pickers = this._root.querySelectorAll("ha-entity-picker");
    pickers.forEach((p) => (p.hass = this._hass));
  }

  _wire() {
    const $ = (s) => this._root.querySelector(s);
    const emit = (cfg) =>
      this.dispatchEvent(
        new CustomEvent("config-changed", { detail: { config: cfg } })
      );

    const onChange = () => {
      const c = this._ensureShape(this._config);
      c.name = $(".i-name")?.value || "";
      const mode = $(".i-mode")?.value || "media_player";
      c.control.mode = mode;
      if (mode === "media_player") {
        c.control.media_player = $(".i-mp")?.value || "";
      } else {
        c.control.mqtt = c.control.mqtt || {};
        c.control.mqtt.command_topic = $(".i-topic")?.value || "";
        c.control.mqtt.play_payload = $(".i-pl")?.value || "PLAY";
        c.control.mqtt.pause_payload = $(".i-pp")?.value || "PAUSE";
        c.control.mqtt.next_payload = $(".i-nx")?.value || "NEXT";
        c.control.mqtt.previous_payload = $(".i-pr")?.value || "PREVIOUS";
      }
      c.entities.title_entity = $(".i-title")?.value || "";
      c.entities.cover_entity = $(".i-cover")?.value || "";
      c.entities.playback_entity = $(".i-playback")?.value || "";
      c.entities.battery_entity = $(".i-bat")?.value || "";
      c.entities.charging_entity = $(".i-chg")?.value || "";
      c.entities.rssi_entity = $(".i-rssi")?.value || "";
      c.show_battery = $(".i-showbat")?.checked || false;
      c.show_rssi = $(".i-showrssi")?.checked || false;

      // Toggle groups
      $(".g-mp").style.display =
        c.control.mode === "media_player" ? "grid" : "none";
      $(".g-mqtt").style.display = c.control.mode === "mqtt" ? "block" : "none";

      this._config = c;
      emit(c);
    };

    this._root
      .querySelectorAll("ha-textfield, ha-entity-picker, ha-switch, ha-select")
      .forEach((el) => {
        el.addEventListener("change", onChange);
        el.addEventListener("value-changed", onChange);
        el.addEventListener("closed", onChange); // ha-select
      });
  }
  _deepClone(o) {
    try {
      return JSON.parse(JSON.stringify(o));
    } catch {
      return {};
    }
  }
  _ensureShape(cfg) {
    const c = this._deepClone(cfg || {});
    const mode = c.control?.mode === "mqtt" ? "mqtt" : "media_player";
    return {
      name: c.name ?? "Toniebox",
      control:
        mode === "media_player"
          ? { mode, media_player: c.control?.media_player ?? "" }
          : {
              mode,
              mqtt: {
                command_topic: c.control?.mqtt?.command_topic ?? "",
                play_payload: c.control?.mqtt?.play_payload ?? "PLAY",
                pause_payload: c.control?.mqtt?.pause_payload ?? "PAUSE",
                next_payload: c.control?.mqtt?.next_payload ?? "NEXT",
                previous_payload:
                  c.control?.mqtt?.previous_payload ?? "PREVIOUS",
              },
            },
      entities: {
        title_entity: c.entities?.title_entity ?? "",
        cover_entity: c.entities?.cover_entity ?? "",
        playback_entity: c.entities?.playback_entity ?? "",
        battery_entity: c.entities?.battery_entity ?? "",
        charging_entity: c.entities?.charging_entity ?? "",
        rssi_entity: c.entities?.rssi_entity ?? "",
      },
      show_battery: c.show_battery !== false,
      show_rssi: !!c.show_rssi,
      tap_action: c.tap_action ?? { action: "more-info" },
    };
  }
}

customElements.define(
  "toniebox-mini-media-card-editor",
  TonieboxMiniMediaCardEditor
);

// Provide card description in Lovelace card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: "toniebox-mini-media-card",
  name: "Toniebox Mini Media Card",
  description:
    "Kompakte Media-Card für Toniebox. Wähle Titel/Playback/Charging/Battery/RSSI über GUI. Steuern via media_player ODER MQTT.",
});
