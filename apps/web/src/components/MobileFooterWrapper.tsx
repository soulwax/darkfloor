// File: apps/web/src/components/MobileFooterWrapper.tsx

"use client";

import { useState } from "react";
import MobileFooter from "./MobileFooter";
import { CreatePlaylistModal } from "./CreatePlaylistModal";

export function MobileFooterWrapper() {
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);

  return (
    <>
      <MobileFooter onCreatePlaylist={() => setShowCreatePlaylistModal(true)} />
      <CreatePlaylistModal
        isOpen={showCreatePlaylistModal}
        onClose={() => setShowCreatePlaylistModal(false)}
      />
    </>
  );
}
