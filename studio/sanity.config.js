import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'

const isDev = process.env.NODE_ENV === 'development'

const plugins = [structureTool()]
if (isDev) {
  const {visionTool} = await import('@sanity/vision')
  plugins.push(visionTool())
}

export default defineConfig({
  name: 'default',
  title: 'metrotapes',
  // Must match the hosted path on metrotapes.com
  basePath: '/studio',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'l3itmzli',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',

  announcements: {enabled: false},
  releases: {enabled: false},
  tasks: {enabled: false},

  plugins,

  schema: {
    types: schemaTypes,
  },
})
