import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'l3itmzli',
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  },
  // Studio is served under metrotapes.com/studio — prefix all built assets
  project: {
    basePath: '/studio',
  },
})
