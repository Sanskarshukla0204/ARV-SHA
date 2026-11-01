import LoadingRing from "../components/splash/LoadingRing";
import styles from "../components/splash/splash.module.css";

/**
 * Route-level loading UI.
  * Next.js shows this automatically (inside your layout, so the header and footer stay
   * visible) while a page's server data is still loading during navigation.
    * It is intentionally small and quiet: the full-screen brand moment lives in SplashScreen.
     */
     export default function Loading() {
       return (
           <div className={styles.routeLoader} role="status" aria-live="polite">
                 <LoadingRing />
                       <p className={styles.wordmark} aria-hidden="true">
                               Arvésha Clothing
                                     </p>
                                           <span className={styles.srOnly}>Loading</span>
                                               </div>
                                                 );
                                                 }
                                                 