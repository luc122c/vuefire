import type { FirebaseApp } from 'firebase/app'
import {
  initializeAppCheck,
  onTokenChanged,
  AppCheckOptions,
  AppCheck,
  getToken,
  AppCheckTokenResult,
} from 'firebase/app-check'
import { App, inject, InjectionKey, Ref, ref } from 'vue-demi'
import { useFirebaseApp } from '../app'
import { getGlobalScope } from '../globals'
import { isClient } from '../shared'

export const AppCheckTokenInjectSymbol: InjectionKey<Ref<string | undefined>> =
  Symbol('app-check-token')

/**
 * The current app-check token as a `Ref`. Note this ref is always undefined on the server.
 */
export function useAppCheckToken() {
  return inject(AppCheckTokenInjectSymbol)!
}

export interface VueFireAppCheckOptions extends AppCheckOptions {
  /**
   * Setups the debug token global. See https://firebase.google.com/docs/app-check/web/debug-provider. Note you should
   * set to false in production (or not set it at all). It can be set to a string to force a specific debug token.
   */
  debug?: boolean | string
}

/**
 * VueFire AppCheck Module to be added to the `VueFire` Vue plugin options. This module **is client only** and shouldn't be added on server.
 *
 * @example
 *
 * ```ts
 * import { createApp } from 'vue'
 * import { VueFire, VueFireAppCheck } from 'vuefire'
 *
 * const app = createApp(App)
 * app.use(VueFire, {
 *   modules: [VueFireAppCheck()],
 * })
 * ```
 */
export function VueFireAppCheck(options: VueFireAppCheckOptions) {
  return (firebaseApp: FirebaseApp, app: App) => {
    // AppCheck requires special treatment on the server
    if (!isClient) return

    // provide this even on the server for simplicity of usage
    const token = getGlobalScope(firebaseApp, app).run(() => ref<string>())!
    app.provide(AppCheckTokenInjectSymbol, token)

    if (options.debug) {
      // @ts-expect-error: local override
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = options.debug
    }

    const appCheck = initializeAppCheck(firebaseApp, options)
    onTokenChanged(appCheck, (newToken) => {
      token.value = newToken.token
    })
    AppCheckMap.set(firebaseApp, appCheck)
  }
}

// TODO: remove this as getAppCheck() already kinda does this
/**
 * To retrieve the current app check
 * @internal
 */
export const AppCheckMap = new WeakMap<FirebaseApp, AppCheck>()

/**
 * Retrieves the Firebase App Check instance.
 *
 * @param name - name of the application
 */
export function useAppCheck(name?: string) {
  return AppCheckMap.get(useFirebaseApp(name))!
}

/**
 * Retrieves the current app check token. If there is no app check token, it will return an empty string token.
 *
 * @param name - name of the application
 * @param forceRefresh - force a refresh of the token
 */
export function getAppCheckToken(
  name?: string,
  forceRefresh?: boolean
): Promise<AppCheckTokenResult> {
  const appCheck = useAppCheck(name)
  return appCheck
    ? getToken(appCheck, forceRefresh)
    : Promise.resolve({ token: '' })
}
