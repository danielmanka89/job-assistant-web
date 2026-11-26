"use client";

import { useSyncExternalStore } from "react";

// Your ON/OFF status: ON (blue) while this tab is open and in front, OFF (red) when you switch away.
// It isn't a control: the app sets it. While ON, the menu checks in every 30 seconds, which is what
// shows you as ON to the people you chat with (their ring glows); when you leave, it turns OFF.

function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const isVisible = () => document.visibilityState === "visible";

export function PresenceSwitch({ className = "" }: { className?: string }) {
  // The server can't know; it renders ON, which is what a visible page is.
  const on = useSyncExternalStore(subscribe, isVisible, () => true);
  const label = on ? "Status: ON, you're in the app" : "Status: OFF, away";
  return (
    <div
      role="status"
      aria-label={label}
      title={label}
      className={`relative h-10 w-[6.5rem] shrink-0 rounded-full border border-white/10 bg-[#1c1d21] shadow-[inset_0_2px_6px_rgb(0_0_0/0.6),0_1px_0_rgb(255_255_255/0.08)] ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-[3px] rounded-full transition-colors duration-300 ${
          on
            ? "bg-[linear-gradient(90deg,#2d5df0,#4f86ff)] shadow-[0_0_16px_rgb(60_110_255/0.55)]"
            : "bg-[linear-gradient(90deg,#ff2d3d,#c8101f)] shadow-[0_0_16px_rgb(255_40_60/0.55)]"
        }`}
      />
      <span
        aria-hidden="true"
        className={`absolute top-[3px] grid h-[calc(100%-6px)] w-9 place-items-center text-xs font-extrabold tracking-wide text-white [text-shadow:0_0_8px_rgb(255_255_255/0.5)] ${on ? "right-[3px]" : "left-[3px]"}`}
      >
        {on ? "ON" : "OFF"}
      </span>
      {/* The knob, with its grid of little dots. */}
      <span
        aria-hidden="true"
        className={`absolute top-[3px] grid h-[calc(100%-6px)] w-[3.75rem] place-items-center rounded-full bg-[linear-gradient(180deg,#4a4c52,#35373c)] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_3px_8px_rgb(0_0_0/0.5),0_0_0_1px_rgb(0_0_0/0.35)] transition-[left] duration-300 motion-reduce:transition-none ${
          on ? "left-[3px]" : "left-[calc(100%-3.75rem-3px)]"
        }`}
      >
        <span className="h-4 w-8 bg-[radial-gradient(circle,rgb(20_21_24/0.75)_1.3px,transparent_1.7px)] [background-size:6.4px_5.4px] [background-position:center]" />
      </span>
    </div>
  );
}
