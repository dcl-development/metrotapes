import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'metrotapes',
  // Must match the hosted path on metrotapes.com
  basePath: '/studio',

  projectId: 'l3itmzli',
  dataset: 'production',

  releases: {enabled: false},

  plugins: [structureTool(), visionTool()],

  schema: {
    types: schemaTypes,
  },
})
