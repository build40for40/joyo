const PRODUCTION_HOST = 'build40for40.com'

const CLIENT_IDS = {
  production: 'client_01M6E5ZDQ9XBYYE28XYN7H3XTJ',
  staging: 'client_01M6E5ZDCH31RFHPJTD8N5JQZY',
}

/** The live site uses the production WorkOS environment. Localhost and PR previews use staging. */
export function workosClientId(hostname: string) {
  return hostname === PRODUCTION_HOST ? CLIENT_IDS.production : CLIENT_IDS.staging
}
