"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import LoadingRing from "./LoadingRing";
import styles from "./splash.module.css";

/** The splash never disappears sooner than this after the page started loading. */
const MIN_DISPLAY_MS = 2200;
/** Safety net: the splash always goes away by this time, even if "load" never fires. */
const MAX_DISPLAY_MS = 6000;
/** Must be at least as long as the CSS fade-out (700ms) in splash.module.css. */
const EXIT_MS = 800;

type Phase = "visible" | "exiting" | "gone";

export default function SplashScreen() {
  // Always starts as "visible" on both server and client, so there is no hydration mismatch.
    const [phase, setPhase] = useState<Phase>("visible");

      // 1) Decide when to start leaving: after the page has fully loaded AND the minimum time has passed.
        useEffect(() => {
            let done = false;
                let exitTimer: number | undefined;
                    let maxTimer: number | undefined;

                        const beginExit = () => {
                              if (done) return;
                                    done = true;
                                          window.clearTimeout(maxTimer);
                                                // performance.now() counts from the start of the page load, so slow loads don't wait extra.
                                                      const wait = Math.max(0, MIN_DISPLAY_MS - performance.now());
                                                            exitTimer = window.setTimeout(() => setPhase("exiting"), wait);
                                                                };

                                                                    if (document.readyState === "complete") {
                                                                          beginExit();
                                                                              } else {
                                                                                    window.addEventListener("load", beginExit, { once: true });
                                                                                        }

                                                                                            maxTimer = window.setTimeout(beginExit, Math.max(0, MAX_DISPLAY_MS - performance.now()));

                                                                                                return () => {
                                                                                                      window.removeEventListener("load", beginExit);
                                                                                                            window.clearTimeout(exitTimer);
                                                                                                                  window.clearTimeout(maxTimer);
                                                                                                                      };
                                                                                                                        }, []);

                                                                                                                          // 2) After the fade-out finishes, remove the splash from the page completely.
                                                                                                                            useEffect(() => {
                                                                                                                                if (phase !== "exiting") return;
                                                                                                                                    const timer = window.setTimeout(() => setPhase("gone"), EXIT_MS);
                                                                                                                                        return () => window.clearTimeout(timer);
                                                                                                                                          }, [phase]);

                                                                                                                                            // 3) Stop the page behind the splash from scrolling while it is fully visible.
                                                                                                                                              useEffect(() => {
                                                                                                                                                  if (phase !== "visible") return;
                                                                                                                                                      const root = document.documentElement;
                                                                                                                                                          const previous = root.style.overflow;
                                                                                                                                                              root.style.overflow = "hidden";
                                                                                                                                                                  return () => {
                                                                                                                                                                        root.style.overflow = previous;
                                                                                                                                                                            };
                                                                                                                                                                              }, [phase]);

                                                                                                                                                                                if (phase === "gone") return null;

                                                                                                                                                                                  return (
                                                                                                                                                                                      <>
                                                                                                                                                                                            {/* If JavaScript is switched off the splash could never close, so hide it. */}
                                                                                                                                                                                                  <noscript>
                                                                                                                                                                                                          <style>{`[data-arvesha-splash]{display:none !important}`}</style>
                                                                                                                                                                                                                </noscript>

                                                                                                                                                                                                                      <div
                                                                                                                                                                                                                              data-arvesha-splash
                                                                                                                                                                                                                                      className={`${styles.splash} ${phase === "exiting" ? styles.exiting : ""}`}
                                                                                                                                                                                                                                              role="status"
                                                                                                                                                                                                                                                      aria-live="polite"
                                                                                                                                                                                                                                                              aria-busy={phase === "visible"}
                                                                                                                                                                                                                                                                    >
                                                                                                                                                                                                                                                                            <div className={styles.stack}>
                                                                                                                                                                                                                                                                                      <div className={styles.logoWrap}>
                                                                                                                                                                                                                                                                                                  <Image
                                                                                                                                                                                                                                                                                                                className={styles.logo}
                                                                                                                                                                                                                                                                                                                              src="/brand/arvesha-logo.png"
                                                                                                                                                                                                                                                                                                                                            alt="Arvésha Clothing"
                                                                                                                                                                                                                                                                                                                                                          width={1080}
                                                                                                                                                                                                                                                                                                                                                                        height={567}
                                                                                                                                                                                                                                                                                                                                                                                      priority
                                                                                                                                                                                                                                                                                                                                                                                                    unoptimized
                                                                                                                                                                                                                                                                                                                                                                                                                  draggable={false}
                                                                                                                                                                                                                                                                                                                                                                                                                              />
                                                                                                                                                                                                                                                                                                                                                                                                                                          <span className={styles.sweep} aria-hidden="true" />
                                                                                                                                                                                                                                                                                                                                                                                                                                                    </div>

                                                                                                                                                                                                                                                                                                                                                                                                                                                              <LoadingRing />

                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <p className={styles.wordmark} aria-hidden="true">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    Arvésha Clothing
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              </p>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <span className={styles.srOnly}>Loading</span>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          </>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            );
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            