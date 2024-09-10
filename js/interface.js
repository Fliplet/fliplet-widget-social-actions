const accessRulesObj = {
  accessRulesBookmarks: [
    { 'type': ['insert'], 'allow': 'all', 'enabled': true,
      'require': [
        { 'Type': { 'equals': 'Bookmark' } }
      ]
    },
    { 'type': ['delete'], 'allow': 'loggedIn', 'enabled': true,
      'require': [
        { 'Type': { 'equals': 'Bookmark' } },
        { 'Email': { 'equals': '{{user.[Email]}}' } }
      ]
    },
    { 'type': ['delete'], 'allow': 'all', 'enabled': true,
      'require': [
        { 'Type': { 'equals': 'Bookmark' } },
        { 'Device Uuid': { 'equals': '{{session.uuid}}' } }
      ]
    },
    { 'type': ['select'], 'allow': 'all', 'enabled': true, 'require': [
      { 'Type': { 'equals': 'Bookmark' } },
      { 'Email': { 'equals': '{{user.[Email]}}' } }
    ]
    },
    // TODO remove this condition when we agree on the security rules
    { 'type': ['select'], 'allow': 'all', 'enabled': true },
    { 'type': ['select'], 'allow': 'all', 'enabled': true,
      'require': [
        { 'Type': { 'equals': 'Bookmark' } },
        { 'Device Uuid': { 'equals': '{{session.uuid}}' } }
      ]
    }
  ],
  accessRulesLikes: [
    { 'type': ['insert'], 'allow': 'loggedIn', 'enabled': true,
      'require': [
        { 'Type': { 'equals': 'Like' } }
      ]
    },
    { 'type': ['delete'], 'allow': 'loggedIn', 'enabled': true,
      'require': [
        { 'Type': { 'equals': 'Like' } },
        { 'Email': { 'equals': '{{user.[Email]}}' } }
      ]
    },
    { 'type': ['select'], 'allow': 'loggedIn', 'enabled': true,
      'require': [
        { 'Type': { 'equals': 'Like' } }
      ]
    }
  ]
};

const accessRules = [...accessRulesObj.accessRulesBookmarks, ...accessRulesObj.accessRulesLikes];
const globalSocialActionsDataSource = 'Global Social Actions';
const appId = Fliplet.Env.get('masterAppId');
const columnsForSocialDataSource = [
  'Email', 'Data Source Id', 'Data Source Entry Id', 'DateTime', 'Type', 'Device Uuid'
];

Fliplet.DataSources.get({
  attributes: ['id', 'name'],
  where: { appId }
})
  .then(function(dataSources) {
    const dsExist = dataSources.find(el => el.name === globalSocialActionsDataSource);

    if (!dsExist) {
      return Fliplet.DataSources.create({
        name: globalSocialActionsDataSource,
        appId,
        columns: columnsForSocialDataSource,
        accessRules
      }).then((newDataSource) => {
        return Promise.resolve(newDataSource.id);
      });
    }

    return Promise.resolve(dsExist.id);
  }).then((dsId) => {
    return Fliplet.Widget.generateInterface({
      title: 'Social actions',
      fields: [
        {
          name: 'typeOfSocialFeature',
          type: 'radio',
          label: 'Select type for social feature',
          options: ['Bookmark', 'Like'],
          default: 'Bookmark'
        },
        {
          name: 'socialDataSourceId',
          type: 'text',
          label: 'Global Social Actions Data Source ID',
          hidden: true,
          default: '',
          ready: function() {
            this.val(dsId);
          }
        },
        {
          name: 'iconSize',
          type: 'radio',
          label: 'Select the icon size',
          default: 'small',
          options: [
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' }
          ]
        }
      ]
    });
  });
