#!/bin/sh
# Refreshes the desktop integration after installing Lyceum (deb/rpm) so the
# file managers pick up the .desktop MIME associations (PDF, EPUB) and list
# Lyceum among the recommended applications.

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q /usr/share/applications >/dev/null 2>&1 || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -ftq /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

exit 0
