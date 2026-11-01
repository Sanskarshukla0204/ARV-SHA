import styles from "./splash.module.css";

/**
 * Delicate circular loading indicator.
  * Pure markup (no hooks, no browser APIs), so it is safe to use from both
   * Server Components (app/loading.tsx) and Client Components (SplashScreen).
    */
    export default function LoadingRing() {
      return (
          <svg
                className={styles.ring}
                      viewBox="0 0 40 40"
                            width="34"
                                  height="34"
                                        fill="none"
                                              aria-hidden="true"
                                                    focusable="false"
                                                        >
                                                              <circle className={styles.ringTrack} cx="20" cy="20" r="18" />
                                                                    <circle className={styles.ringArc} cx="20" cy="20" r="18" />
                                                                        </svg>
                                                                          );
                                                                          }
                                                                          