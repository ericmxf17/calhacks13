import type { Access, CollectionConfig } from 'payload'

const ownAccount: Access = ({ req }) =>
  req.user?.collection === 'users' ? { id: { equals: req.user.id } } : false

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7, maxLoginAttempts: 5, lockTime: 600000,
  },
  admin: { useAsTitle: 'email' },
  access: {
    admin: () => false,
    create: () => true,
    read: ownAccount,
    update: ownAccount,
    delete: ownAccount,
  },
  fields: [
    {
      name: 'business',
      type: 'group',
      access: {
        create: () => false,
        update: ({ req }) => req.user?.collection === 'users',
      },
      fields: [
        { name: 'company', type: 'text', maxLength: 120 },
        { name: 'website', type: 'text', maxLength: 300 },
        { name: 'offering', type: 'text', maxLength: 500 },
        { name: 'channels', type: 'text', maxLength: 500 },
        { name: 'demo', type: 'checkbox' },
        {
          name: 'products',
          type: 'array',
          maxRows: 50,
          fields: [
            { name: 'name', type: 'text', required: true, maxLength: 120 },
            { name: 'price', type: 'number', required: true, min: 0 },
            { name: 'units', type: 'number', required: true, min: 0 },
          ],
        },
        {
          name: 'parts',
          type: 'array',
          maxRows: 1000,
          fields: [
            { name: 'supplier', type: 'text', required: true, maxLength: 200 },
            { name: 'part', type: 'text', required: true, maxLength: 200 },
            { name: 'cost', type: 'number', required: true, min: 0 },
          ],
        },
      ],
    },
  ],
}
