# Toniebox Mini Media Card

Kompakte Lovelace-Karte für Toniebox-Entities (MQTT).

## Installation

1. Repo zu HACS hinzufügen (Frontend).
2. Ressource in HA eintragen:
   - URL: /hacsfiles/toniebox-mini-media-card/toniebox-mini-media-card.js
   - Typ: module

## Beispiel

type: custom:toniebox-mini-media-card
entity: media_player.toniebox
last_title_entity: sensor.toniebox_last_title
last_cover_entity: sensor.toniebox_last_cover_url
charging_entity: binary_sensor.toniebox_charging
battery_entity: sensor.toniebox_battery
rssi_entity: sensor.toniebox_wifi_rssi
show_last_title: true
show_battery: true
show_rssi: false
