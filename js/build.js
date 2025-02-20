/* eslint-disable max-len */
// With custom security rules
Fliplet.Widget.instance({
  name: 'social-actions',
  displayName: 'Data interactive icon',
  render: {
    template: [
      '<div class="social-actions">',
      '<i class="bookmark fa fa-bookmark-o" aria-hidden="true"></i>',
      '<div class="like-container">',
      '<span class="like-count">0</span>',
      '<i class="like fa fa-heart-o" aria-hidden="true"></i>',
      '</div>',
      '</div>'
    ].join(''),
    data: {
      dataSourceLfdId: null
    },
    ready: async function() {
      const socialAction = this;
      const socialActionInstanceId = socialAction.id;

      const parents = await Fliplet.Widget.findParents({
        instanceId: socialActionInstanceId
      });

      /**
       * Finds and returns the parent widget and its entry data for a specified widget type
       * @param {('RecordContainer'|'ListRepeater'|'DynamicContainer')} type - The type of parent widget to search for
       * @returns {Promise<[Object|null, Object|null]>} A tuple containing:
       *   - The parent widget configuration if found, null otherwise
       *   - The parent widget instance if found, null otherwise
       * @async
       * @private
       */
      const findParentDataWidget = async (type, packageName) => {
        const parent = parents.find((parent) => parent.package === packageName);

        if (!parent) {
          return [null, null];
        }

        const instance = await Fliplet[type].get({ id: parent.id });
        return [parent, instance];
      }

      const [[ dynamicContainer ], [ recordContainer, recordContainerInstance ], [ listRepeater, listRepeaterInstance ]] = await Promise.all([
        findParentDataWidget('DynamicContainer', 'com.fliplet.dynamic-container'),
        findParentDataWidget('RecordContainer', 'com.fliplet.record-container'),
        findParentDataWidget('ListRepeater', 'com.fliplet.list-repeater')
      ]);

      const ENTRY = recordContainerInstance?.entry || listRepeaterInstance?.entry || {};
      const entry = ENTRY;

      // TODO: remove this function when the product provides a solution
      function errorMessageStructureNotValid($element, message) {
        $element.addClass('component-error-before-xxx');
        Fliplet.UI.Toast(message);
      }

      if (!dynamicContainer || !dynamicContainer.dataSourceId) {
        return errorMessageStructureNotValid($(socialAction.$el), 'This component needs to be placed inside a Data container and select a data source');
      }

      if (!recordContainer && !listRepeater) {
        return errorMessageStructureNotValid($(socialAction.$el), 'This component needs to be placed inside a Data record or Data list component');
      }

      socialAction.dataSourceLfdId = dynamicContainer.dataSourceId;

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
      const deviceUuid = Fliplet.Profile.getDeviceUuid().uuid;
      const globalSocialActionsDataSource = 'Global Data interactive icon';

      socialAction.fields = _.assign(
        {
          typeOfSocialFeature: undefined
        },
        socialAction.fields
      );

      const selectedOption = socialAction.fields.typeOfSocialFeature;
      const columnsForSocialDataSource = [
        'Email', 'Data Source Id', 'Data Source Entry Id', 'Datetime', 'Type', 'Device Uuid'
      ];
      const appId = Fliplet.Env.get('appId');

      manageSocialActionDataSource(socialAction.dataSourceLfdId, entry.id);

      // TODO - Fliplet.DataSources.get and Fliplet.DataSources.create might be sufficient
      // TODO - it is not optimized at all to call get and create every time
      // TODO - Eng should create a solution to create this DS on every app creation?
      // TODO - It might be better to be hidden from the user
      function manageSocialActionDataSource(dataSourceId, entryId) {
        return Fliplet.DataSources.get({
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
              }).then(function(newDataSource) {
                setAttributes(dataSourceId, newDataSource.id, entryId);
                setActionClickEvent();
              });
            }

            setAttributes(dataSourceId, dsExist.id, entryId);
            setActionClickEvent();
          });
      }

      function handleSession(session) {
      // check if the user is connected to a dataSource login
      if (session.entries.dataSource) {
        return _.get(session, 'entries.dataSource.data');
      }

      // check if the user is connected to a SAML2 login
      if (session.entries.saml2) {
        return _.get(session, 'entries.saml2.user');
      }

      // check if the user is connected to a Fliplet login
      if (session.entries.flipletLogin) {
        return _.get(session, 'entries.flipletLogin');
      }
    }

    function setActionClickEvent() {
      $('.social-actions').off('click').on('click', function() {
        const $thisClick = $(this);
        const originalDataSource = $thisClick.data('original-datasource-id');
        const globalDataSourceId = $thisClick.data('global-datasource-id');
        const dataSourceEntryId = $thisClick.data('entry-id');

        return Fliplet.User.getCachedSession().then(function(session) {
          let user = '';

          if (session && session.entries) {
            user = handleSession(session);
          }

          return Fliplet.DataSources.connect(globalDataSourceId)
            .then(function(connection) {
              let where = {
                'Data Source Id': originalDataSource,
                'Data Source Entry Id': dataSourceEntryId,
                'Type': $thisClick.find('.bookmark:visible').length !== 0 ? 'Bookmark' : 'Like'
              };

              if (user) {
                where.Email = user.Email;
              } else {
                where['Device Uuid'] = deviceUuid;
              }

              return connection.findOne({
                where
              }).then(function(record) {
                if (record) {
                  return connection.removeById(record.id)
                    .then(function onRemove() {
                      if ($thisClick.find('.bookmark:visible').length !== 0) {
                        $thisClick.find('.bookmark').toggleClass('fa-bookmark fa-bookmark-o');
                      } else {
                        $thisClick.find('.like').toggleClass('fa-heart fa-heart-o');
                        $thisClick.find('.like-count').html(Number($thisClick.find('.like-count').text()) - 1);
                      }
                    });
                }

                return connection.insert({
                  'Email': user ? user.Email : '',
                  'Device Uuid': deviceUuid,
                  'Data Source Id': originalDataSource,
                  'Data Source Entry Id': dataSourceEntryId,
                  'Datetime': new Date().toISOString(),
                  'Type': $thisClick.find('.bookmark:visible').length !== 0 ? 'Bookmark' : 'Like'
                }).then(function() {
                  if ($thisClick.find('.bookmark:visible').length !== 0) {
                    $thisClick.find('.bookmark').toggleClass('fa-bookmark fa-bookmark-o');
                  } else {
                    $thisClick.find('.like').toggleClass('fa-heart fa-heart-o');
                    $thisClick.find('.like-count').html(Number($thisClick.find('.like-count').text()) + 1);
                  }
                });
              });
            });
        });
      });
    }

    function setAttributes(dataSourceId, globalDataSourceId, entryId) {
      const $el = $(socialAction.$el);

      return Fliplet.User.getCachedSession().then(function(session) {
        let user = '';

        if (session && session.entries) {
          user = handleSession(session);
        }

        return Fliplet.DataSources.connect(globalDataSourceId)
          .then(function(connection) {
            let where = {
              'Data Source Id': dataSourceId,
              'Data Source Entry Id': entryId,
              'Type': selectedOption
            };

            if (user) {
              where.Email = user.Email;
            } else {
              where['Device Uuid'] = deviceUuid;
            }

              if (selectedOption === 'Bookmark') {
                return connection.findOne({
                  where
                }).then(function(record) {
                  $el.find('.like').hide();
                  $el.find('.bookmark').show();

                  if (record) {
                    $el.find('.bookmark')
                      .addClass('fa-bookmark')
                      .removeClass('fa-bookmark-o');
                  }

                  $el.find('.social-actions')
                    .attr('data-original-datasource-id', dataSourceId);
                  $el.find('.social-actions')
                    .attr('data-global-datasource-id', globalDataSourceId);
                  $el.find('.social-actions')
                    .attr('data-entry-id', entryId);
                });
              } else if (selectedOption === 'Like') {
                return connection.find({
                  where,
                  attributes: ['Email', 'Device Uuid']
                }).then(function(records) {
                  $el.find('.like').show();
                  $el.find('.like-count').show();
                  $el.find('.like-container').css('display', 'flex');

                  if (records && records.find(el =>
                    el.data.Email === (user ? user.Email : '') || el.data['Device Uuid'] === deviceUuid)) {
                    $el.find('.like')
                      .addClass('fa-heart')
                      .removeClass('fa-heart-o');
                  }

                  let currentSocialAction = $el.find('.social-actions');

                  currentSocialAction
                    .attr('data-original-datasource-id', dataSourceId)
                    .attr('data-global-datasource-id', globalDataSourceId)
                    .attr('data-entry-id', entryId);
                  currentSocialAction.find('.like-count').html(records.length);
                });
              }
            });
        });
      }
    },
    views: [
      {
        name: 'typeContent',
        displayName: 'typeContent',
        placeholder: '<div class="well text-center"></div>'
      }
    ]
  }
});
