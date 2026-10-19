"use client";

import React, { useState } from "react";
import Image from "next/image";

// Logo sidebar mengikuti tipe organisasi. Logo PGSOL: taruh file di
// public/assets/logo/pgsol-logo.png — selama belum ada, tampil wordmark teks.
const LOGOS = {
  pgn: { src: "/assets/logo/main-logo.png", alt: "Pertamina Gas Negara" },
  pgsol: { src: "/assets/logo/pgsol-logo.png", alt: "PGAS Solution" },
} as const;

export function SidebarLogo({ orgType, align = "center" }: { orgType?: "pgn" | "pgsol" | "vendor"; align?: "center" | "left" }) {
  const key = orgType === "pgsol" ? "pgsol" : "pgn";
  const logo = LOGOS[key];
  const [failed, setFailed] = useState(false);

  return (
    <div>
      <div className="relative h-8 w-32">
        {failed ? (
          <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold tracking-tight text-white">
            PGAS SOLUTION
          </span>
        ) : (
          <Image
            src={logo.src}
            alt={logo.alt}
            fill
            onError={() => setFailed(true)}
            className={`object-contain brightness-0 invert ${align === "left" ? "object-left" : "object-center"}`}
          />
        )}
      </div>
    </div>
  );
}
