#!/usr/bin/env python3
"""
Nuvem Linux - Indicador da Barra de Sistema (Tray / AppIndicator)
Exibe o ícone e progresso de sincronização em tempo real na barra superior do GNOME / Ubuntu.
"""
import os
import sys
import json
import time
import urllib.request
import subprocess
import dbus
import dbus.service
from dbus.mainloop.glib import DBusGMainLoop
from gi.repository import GLib

ICONS_DIR = os.path.expanduser("~/.local/share/nuvem-linux/icons")
SYNC_FOLDERS_PATH = os.path.expanduser("~/.local/share/nuvem-linux/sync-folders.json")
API_BASE = "http://localhost:4173/api"

def open_dashboard():
    # 1. Tenta abrir via CLI do nuvem-linux (abre no modo aplicativo limpo)
    for bin_path in ["/usr/bin/nuvem-linux", "/usr/local/bin/nuvem-linux"]:
        if os.path.exists(bin_path):
            try:
                subprocess.Popen([bin_path, "open"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return
            except Exception:
                pass

    # 2. Tenta abrir via XDG Desktop Portal (garante abertura no ambiente gráfico do usuário)
    try:
        bus = dbus.SessionBus()
        portal = bus.get_object("org.freedesktop.portal.Desktop", "/org/freedesktop/portal/desktop")
        open_uri = portal.get_dbus_method("OpenURI", "org.freedesktop.portal.OpenURI")
        open_uri("", "http://localhost:4173", {})
        return
    except Exception:
        pass

    # 3. Fallbacks com navegadores instalados em modo app ou gio/xdg-open
    for cmd in [
        ["microsoft-edge", "--app=http://localhost:4173"],
        ["google-chrome", "--app=http://localhost:4173"],
        ["gio", "open", "http://localhost:4173"],
        ["xdg-open", "http://localhost:4173"]
    ]:
        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        except Exception:
            pass

def open_folder(path):
    if not path or not os.path.exists(path):
        return
    for cmd in [["gio", "open", path], ["xdg-open", path]]:
        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        except Exception:
            pass

DBusGMainLoop(set_as_default=True)

class NuvemDBusMenu(dbus.service.Object):
    def __init__(self, bus, path, indicator):
        super().__init__(bus, path)
        self.indicator = indicator
        self.revision = 1

    @dbus.service.method("com.canonical.dbusmenu", in_signature="iias", out_signature="u(ia{sv}av)")
    def GetLayout(self, parent_id, recursion_depth, property_names):
        items = self.indicator.build_menu_items()
        children = []
        for it in items:
            props = {
                "label": dbus.String(it.get("label", "")),
                "enabled": dbus.Boolean(it.get("enabled", True)),
                "visible": dbus.Boolean(True),
            }
            if it.get("type"):
                props["type"] = dbus.String(it["type"])
            if it.get("icon-name"):
                props["icon-name"] = dbus.String(it["icon-name"])
            children.append(dbus.Struct((dbus.Int32(it["id"]), dbus.Dictionary(props, signature="sv"), dbus.Array([], signature="v")), signature="ia{sv}av"))

        root = dbus.Struct((dbus.Int32(0), dbus.Dictionary({}, signature="sv"), dbus.Array(children, signature="v")), signature="ia{sv}av")
        return (dbus.UInt32(self.revision), root)

    @dbus.service.method("com.canonical.dbusmenu", in_signature="isvu", out_signature="")
    def Event(self, id, event_id, data, timestamp):
        if event_id == "clicked":
            self.indicator.handle_menu_action(id)

    @dbus.service.method("com.canonical.dbusmenu", in_signature="a(isvu)", out_signature="ai")
    def EventGroup(self, events):
        not_handled = []
        for ev in events:
            try:
                item_id = int(ev[0])
                event_id = str(ev[1])
                if event_id == "clicked":
                    self.indicator.handle_menu_action(item_id)
            except Exception as e:
                print(f"Erro ao processar evento de menu: {e}", file=sys.stderr)
        return dbus.Array(not_handled, signature="i")

    @dbus.service.method("com.canonical.dbusmenu", in_signature="i", out_signature="b")
    def AboutToShow(self, id):
        return False

    @dbus.service.method("com.canonical.dbusmenu", in_signature="ai", out_signature="aiai")
    def AboutToShowGroup(self, ids):
        return (dbus.Array([], signature="i"), dbus.Array([], signature="i"))

    @dbus.service.method("com.canonical.dbusmenu", in_signature="aias", out_signature="a(ia{sv})")
    def GetGroupProperties(self, ids, property_names):
        return []

    @dbus.service.method("com.canonical.dbusmenu", in_signature="is", out_signature="v")
    def GetProperty(self, id, name):
        return ""

    @dbus.service.signal("com.canonical.dbusmenu", signature="ui")
    def LayoutUpdated(self, revision, parent):
        pass


class NuvemStatusNotifierItem(dbus.service.Object):
    def __init__(self, bus, path):
        super().__init__(bus, path)
        self.bus = bus
        self.icon_name = "nuvem-idle"
        self.status = "Active"
        self.title = "Nuvem Linux"
        self.tooltip_text = "Nuvem Linux - Sincronizado"
        self.menu_items = []
        self.menu_action_map = {}

    @dbus.service.method("org.kde.StatusNotifierItem", in_signature="ii", out_signature="")
    def Activate(self, x, y):
        # Click opens web dashboard
        open_dashboard()

    @dbus.service.method("org.kde.StatusNotifierItem", in_signature="ii", out_signature="")
    def ContextMenu(self, x, y):
        pass

    @dbus.service.method("org.freedesktop.DBus.Properties", in_signature="ss", out_signature="v")
    def Get(self, interface, prop):
        return self.GetAll(interface).get(prop, "")

    @dbus.service.method("org.freedesktop.DBus.Properties", in_signature="s", out_signature="a{sv}")
    def GetAll(self, interface):
        if interface == "org.kde.StatusNotifierItem":
            return {
                "Category": dbus.String("ApplicationStatus"),
                "Id": dbus.String("nuvem-linux"),
                "Title": dbus.String(self.title),
                "Status": dbus.String(self.status),
                "IconName": dbus.String(self.icon_name),
                "IconThemePath": dbus.String(ICONS_DIR),
                "Menu": dbus.ObjectPath("/MenuBar"),
                "ToolTip": dbus.Struct((
                    dbus.String(self.icon_name),
                    dbus.Array([], signature="(iiay)"),
                    dbus.String("Nuvem Linux"),
                    dbus.String(self.tooltip_text)
                ), signature="sa(iiay)ss")
            }
        return {}

    @dbus.service.signal("org.kde.StatusNotifierItem")
    def NewIcon(self):
        pass

    @dbus.service.signal("org.kde.StatusNotifierItem")
    def NewToolTip(self):
        pass

    @dbus.service.signal("org.kde.StatusNotifierItem", signature="s")
    def NewStatus(self, status):
        pass

    def build_menu_items(self):
        return self.menu_items

    def handle_menu_action(self, item_id):
        action = self.menu_action_map.get(item_id)
        if not action:
            return
        act_type = action.get("type")
        if act_type == "open_dash":
            open_dashboard()
        elif act_type == "open_folder":
            open_folder(action.get("path"))
        elif act_type == "sync_all":
            self.sync_all_folders()
        elif act_type == "toggle_pause":
            self.toggle_pause()
        elif act_type == "quit":
            sys.exit(0)

    def sync_all_folders(self):
        try:
            with open(SYNC_FOLDERS_PATH, "r", encoding="utf-8") as f:
                folders = json.load(f)
            for folder in folders:
                fid = folder.get("id")
                if fid and not folder.get("paused"):
                    req = urllib.request.Request(f"{API_BASE}/folders/{fid}/sync", data=b"{}", headers={"Content-Type": "application/json"})
                    urllib.request.urlopen(req, timeout=3)
        except Exception:
            pass

    def toggle_pause(self):
        try:
            with open(SYNC_FOLDERS_PATH, "r", encoding="utf-8") as f:
                folders = json.load(f)
            any_unpaused = any(not f.get("paused") for f in folders)
            endpoint = "pause" if any_unpaused else "resume"
            for folder in folders:
                fid = folder.get("id")
                if fid:
                    req = urllib.request.Request(f"{API_BASE}/folders/{fid}/{endpoint}", data=b"{}", headers={"Content-Type": "application/json"})
                    urllib.request.urlopen(req, timeout=3)
        except Exception:
            pass

    def update_state(self):
        folders = []
        try:
            if os.path.exists(SYNC_FOLDERS_PATH):
                with open(SYNC_FOLDERS_PATH, "r", encoding="utf-8") as f:
                    folders = json.load(f)
        except Exception:
            folders = []

        is_syncing = False
        is_error = False
        all_paused = len(folders) > 0 and all(f.get("paused") for f in folders)
        syncing_names = []

        for f in folders:
            state = f.get("status", {}).get("state", "ok")
            name = os.path.basename(f.get("localPath", "")) or "Pasta"
            if state == "syncing":
                is_syncing = True
                syncing_names.append(name)
            elif state == "error":
                is_error = True

        new_icon = "nuvem-idle"
        new_status = "Active"
        new_tooltip = "Nuvem Linux - Sincronizado"

        if is_syncing:
            new_icon = "nuvem-syncing"
            names_str = ", ".join(syncing_names[:2])
            new_tooltip = f"Nuvem Linux - Sincronizando ({names_str})…"
        elif is_error:
            new_icon = "nuvem-error"
            new_status = "NeedsAttention"
            new_tooltip = "Nuvem Linux - Erro de sincronização"
        elif all_paused:
            new_icon = "nuvem-paused"
            new_tooltip = "Nuvem Linux - Sincronização pausada"

        icon_changed = (new_icon != self.icon_name)
        status_changed = (new_status != self.status)
        tooltip_changed = (new_tooltip != self.tooltip_text)

        self.icon_name = new_icon
        self.status = new_status
        self.tooltip_text = new_tooltip

        if icon_changed:
            self.NewIcon()
        if status_changed:
            self.NewStatus(new_status)
        if tooltip_changed:
            self.NewToolTip()

        # Rebuild menu items
        items = []
        actions = {}
        curr_id = 1

        # Header status
        header_text = "☁️ Nuvem Linux: Sincronizado"
        if is_syncing:
            header_text = f"🔄 Sincronizando {syncing_names[0] if syncing_names else ''}…"
        elif is_error:
            header_text = "⚠️ Atenção: Erro na sincronização"
        elif all_paused:
            header_text = "⏸️ Sincronização Pausada"

        items.append({"id": curr_id, "label": header_text, "enabled": False})
        curr_id += 1
        items.append({"id": curr_id, "type": "separator"})
        curr_id += 1

        # Actions
        items.append({"id": curr_id, "label": "🔄 Sincronizar tudo agora", "enabled": not all_paused})
        actions[curr_id] = {"type": "sync_all"}
        curr_id += 1

        items.append({"id": curr_id, "label": "🌐 Abrir painel web", "enabled": True})
        actions[curr_id] = {"type": "open_dash"}
        curr_id += 1

        if folders:
            items.append({"id": curr_id, "type": "separator"})
            curr_id += 1
            for f in folders:
                lp = f.get("localPath")
                fname = os.path.basename(lp) if lp else "Pasta"
                items.append({"id": curr_id, "label": f"📁 Abrir {fname}", "enabled": True})
                actions[curr_id] = {"type": "open_folder", "path": lp}
                curr_id += 1

        items.append({"id": curr_id, "type": "separator"})
        curr_id += 1

        pause_label = "▶️ Retomar sincronização" if all_paused else "⏸️ Pausar sincronização"
        items.append({"id": curr_id, "label": pause_label, "enabled": len(folders) > 0})
        actions[curr_id] = {"type": "toggle_pause"}
        curr_id += 1

        items.append({"id": curr_id, "label": "🚪 Fechar indicador", "enabled": True})
        actions[curr_id] = {"type": "quit"}

        self.menu_items = items
        self.menu_action_map = actions
        if hasattr(self, "menu_obj"):
            self.menu_obj.revision += 1
            self.menu_obj.LayoutUpdated(self.menu_obj.revision, 0)


def main():
    bus = dbus.SessionBus()
    bus_name = dbus.service.BusName(f"org.kde.StatusNotifierItem-nuvem-linux-{os.getpid()}", bus)

    item = NuvemStatusNotifierItem(bus, "/StatusNotifierItem")
    menu = NuvemDBusMenu(bus, "/MenuBar", item)
    item.menu_obj = menu

    # Initial state update
    item.update_state()

    # Register with watcher
    try:
        watcher = bus.get_object("org.kde.StatusNotifierWatcher", "/StatusNotifierWatcher")
        watcher.RegisterStatusNotifierItem("/StatusNotifierItem", dbus_interface="org.kde.StatusNotifierWatcher")
    except Exception as e:
        print(f"Warning: Could not register with StatusNotifierWatcher: {e}", file=sys.stderr)

    # Periodic poll
    def on_timer():
        try:
            item.update_state()
        except Exception:
            pass
        return True

    GLib.timeout_add_seconds(2, on_timer)

    loop = GLib.MainLoop()
    try:
        loop.run()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
