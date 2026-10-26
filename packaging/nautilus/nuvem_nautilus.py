"""
Nuvem Linux - Extensão do Nautilus
Adiciona emblemas de status de sincronização (como no Dropbox) e ações no menu de contexto.
"""
import os
import json
import time
import urllib.parse
import urllib.request
import subprocess
from gi.repository import Nautilus, GObject

SYNC_FOLDERS_PATH = os.path.expanduser("~/.local/share/nuvem-linux/sync-folders.json")
API_BASE = "http://localhost:4173/api"

class NuvemCache:
    _cache = []
    _last_mtime = 0
    _last_read = 0

    @classmethod
    def get_folders(cls):
        now = time.time()
        if now - cls._last_read < 2.0:
            return cls._cache
        cls._last_read = now

        try:
            if not os.path.exists(SYNC_FOLDERS_PATH):
                cls._cache = []
                return []
            mtime = os.path.getmtime(SYNC_FOLDERS_PATH)
            if mtime != cls._last_mtime:
                with open(SYNC_FOLDERS_PATH, "r", encoding="utf-8") as f:
                    cls._cache = json.load(f)
                cls._last_mtime = mtime
        except Exception:
            pass
        return cls._cache


class NuvemNautilus(GObject.GObject, Nautilus.InfoProvider, Nautilus.MenuProvider):
    def __init__(self):
        super().__init__()

    def update_file_info(self, file):
        location = file.get_location()
        if not location:
            return Nautilus.OperationResult.COMPLETE

        filepath = location.get_path()
        if not filepath:
            return Nautilus.OperationResult.COMPLETE

        folders = NuvemCache.get_folders()
        if not folders:
            return Nautilus.OperationResult.COMPLETE

        for folder in folders:
            local_path = folder.get("localPath")
            if not local_path:
                continue

            # Exact match: the synchronized root folder itself
            if filepath == local_path:
                state = folder.get("status", {}).get("state", "ok")
                paused = folder.get("paused", False)
                if paused:
                    file.add_emblem("emblem-important")
                elif state == "syncing":
                    file.add_emblem("emblem-synchronizing")
                elif state == "error":
                    file.add_emblem("emblem-important")
                elif state == "conflict":
                    file.add_emblem("emblem-important")
                else:
                    file.add_emblem("emblem-default")
                return Nautilus.OperationResult.COMPLETE

            # Child file or directory
            if filepath.startswith(local_path + os.sep):
                rel_path = os.path.relpath(filepath, local_path)
                if rel_path.startswith(".nuvem-linux-trash"):
                    return Nautilus.OperationResult.COMPLETE

                if ".conflito" in rel_path:
                    file.add_emblem("emblem-important")
                    return Nautilus.OperationResult.COMPLETE

                folder_state = folder.get("status", {}).get("state", "ok")
                if folder.get("paused", False):
                    file.add_emblem("emblem-important")
                    return Nautilus.OperationResult.COMPLETE

                if folder_state == "syncing":
                    file.add_emblem("emblem-synchronizing")
                    return Nautilus.OperationResult.COMPLETE

                if folder_state == "error":
                    file.add_emblem("emblem-important")
                    return Nautilus.OperationResult.COMPLETE

                # Check if it matches baseline
                baseline = folder.get("baseline", [])
                baseline_map = {b.get("Path"): b for b in baseline if isinstance(b, dict)}

                if rel_path in baseline_map:
                    base_entry = baseline_map[rel_path]
                    try:
                        st = os.stat(filepath)
                        # If size matches, it's synchronized
                        if st.st_size == base_entry.get("Size"):
                            file.add_emblem("emblem-default")
                        else:
                            file.add_emblem("emblem-synchronizing")
                    except Exception:
                        file.add_emblem("emblem-synchronizing")
                else:
                    # If it's a directory inside the sync folder
                    if os.path.isdir(filepath):
                        file.add_emblem("emblem-default")
                    else:
                        # New file pending sync
                        file.add_emblem("emblem-synchronizing")

                return Nautilus.OperationResult.COMPLETE

        return Nautilus.OperationResult.COMPLETE

    def get_file_items(self, files):
        if not files:
            return []

        folders = NuvemCache.get_folders()
        if not folders:
            return []

        matched_folder = None
        for file in files:
            location = file.get_location()
            if not location:
                continue
            path = location.get_path()
            if not path:
                continue
            for folder in folders:
                lp = folder.get("localPath")
                if lp and (path == lp or path.startswith(lp + os.sep)):
                    matched_folder = folder
                    break
            if matched_folder:
                break

        if not matched_folder:
            return []

        folder_id = matched_folder.get("id")
        items = []

        item_sync = Nautilus.MenuItem(
            name="NuvemLinux::SyncNow",
            label="Nuvem Linux: Sincronizar agora",
            tip="Forçar sincronização com o Google Drive",
            icon="emblem-synchronizing"
        )
        def on_sync_clicked(_):
            try:
                req = urllib.request.Request(f"{API_BASE}/folders/{folder_id}/sync", data=b"{}", headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=5)
            except Exception:
                pass
        item_sync.connect("activate", on_sync_clicked)
        items.append(item_sync)

        item_open = Nautilus.MenuItem(
            name="NuvemLinux::OpenDashboard",
            label="Nuvem Linux: Abrir painel",
            tip="Abrir o painel web do Nuvem Linux",
            icon="emblem-default"
        )
        def on_open_clicked(_):
            subprocess.Popen(["xdg-open", "http://localhost:4173"])
        item_open.connect("activate", on_open_clicked)
        items.append(item_open)

        return items

    def get_background_items(self, current_folder):
        location = current_folder.get_location()
        if not location:
            return []
        path = location.get_path()
        if not path:
            return []

        folders = NuvemCache.get_folders()
        matched = None
        for f in folders:
            lp = f.get("localPath")
            if lp and (path == lp or path.startswith(lp + os.sep)):
                matched = f
                break

        if not matched:
            return []

        folder_id = matched.get("id")
        items = []

        item_sync = Nautilus.MenuItem(
            name="NuvemLinux::BgSyncNow",
            label="Nuvem Linux: Sincronizar esta pasta",
            icon="emblem-synchronizing"
        )
        def on_sync_clicked(_):
            try:
                req = urllib.request.Request(f"{API_BASE}/folders/{folder_id}/sync", data=b"{}", headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=5)
            except Exception:
                pass
        item_sync.connect("activate", on_sync_clicked)
        items.append(item_sync)

        item_dash = Nautilus.MenuItem(
            name="NuvemLinux::BgOpenDash",
            label="Nuvem Linux: Abrir painel",
            icon="emblem-default"
        )
        def on_dash_clicked(_):
            subprocess.Popen(["xdg-open", "http://localhost:4173"])
        item_dash.connect("activate", on_dash_clicked)
        items.append(item_dash)

        return items
