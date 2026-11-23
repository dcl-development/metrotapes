import {defineField, defineType} from 'sanity'

/** Shared media object used by home / article */
export const mediaItem = defineType({
  name: 'mediaItem',
  title: 'Media Item',
  type: 'object',
  fields: [
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          {title: 'Image', value: 'image'},
          {title: 'Link', value: 'link'},
          {title: 'YouTube Video', value: 'youtube'},
          {title: 'Instagram Post', value: 'instagram'},
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
      hidden: ({parent}) => parent?.type !== 'image',
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      hidden: ({parent}) => parent?.type !== 'link',
    }),
    defineField({
      name: 'videoUrl',
      title: 'YouTube Video URL',
      type: 'url',
      description: 'Paste the full YouTube video URL',
      hidden: ({parent}) => parent?.type !== 'youtube',
    }),
    defineField({
      name: 'videoId',
      title: 'YouTube Video ID / URL',
      type: 'string',
      hidden: ({parent}) => parent?.type !== 'youtube',
    }),
    defineField({
      name: 'instagramPost',
      title: 'Instagram Post URL',
      type: 'url',
      hidden: ({parent}) => parent?.type !== 'instagram',
    }),
    defineField({
      name: 'alt',
      title: 'Alt Text / Link Text',
      type: 'string',
    }),
  ],
})
