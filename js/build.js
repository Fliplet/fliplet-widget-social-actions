/* eslint-disable max-len */
// With custom security rules
Fliplet.Widget.instance({
  name: 'social-actions',
  displayName: 'Social actions',
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
    ready: async function() {
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
      const globalSocialActionsDataSource = 'Global Social Actions';
      const socialActionThis = this;

      socialActionThis.fields = _.assign(
        {
          typeOfSocialFeature: undefined
        },
        socialActionThis.fields
      );

      const selectedOption = socialActionThis.fields.typeOfSocialFeature;
      const columnsForSocialDataSource = [
        'Email', 'Data Source Id', 'Data Source Entry Id', 'Datetime', 'Type', 'Device Uuid'
      ];
      const appId = Fliplet.Env.get('appId');

      // record container from detail page
      Fliplet.Hooks.on('recordContainerDataRetrieved', function(record) {
        manageSocialActionDataSource(record.entry.dataSourceId, record.entry.id);
      });

      // TODO uncomment for list repeater and test it
      Fliplet.Hooks.on('repeaterDataRetrieved', function(options) {
        if (options.data.length) {
          manageSocialActionDataSource(options.data[0].dataSourceId, options.data.map(el => el.id));
        }
      });

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
        const $el = $(socialActionThis.$el);

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

              if (Array.isArray(entryId)) { // from list repeater
                where['Data Source Entry Id'] = { $in: entryId };
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

                  let socialAction = $el.find('.social-actions');

                  socialAction
                    .attr('data-original-datasource-id', dataSourceId)
                    .attr('data-global-datasource-id', globalDataSourceId)
                    .attr('data-entry-id', entryId);
                  socialAction.find('.like-count').html(records.length);
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

// With views - TODO remove at the end
// Fliplet.Widget.instance({
//   name: 'social-actions',
//   displayName: 'Social actions',
//   render: {
//     template: [
//       '<div class="social-actions">',
//       '<i class="bookmark fa fa-bookmark-o" aria-hidden="true"></i>',
//       '<div class="like-container">',
//       '<span class="like-count">0</span>',
//       '<i class="like fa fa-heart-o" aria-hidden="true"></i>',
//       '</div>',
//       '</div>'
//     ].join(''),
//     ready: async function() {
//       const deviceUuid = Fliplet.Profile.getDeviceUuid().uuid;
//       const globalSocialActionsDataSource = 'Global Social Actions';
//       const socialActionThis = this;
//       const selectedOption = this.fields.typeOfSocialFeature;
//       const columnsForSocialDataSource = [
//         'Email', 'Data Source Id', 'Data Source Entry Id', 'Datetime', 'Type', 'Device Uuid'
//       ];

//       debugger;
//       // record container from detail page
//       Fliplet.Hooks.on('recordContainerDataRetrieved', function(record) {
//         manageSocialActionDataSource(record.entry.dataSourceId, record.entry.id);
//       });

//       // list repeater
//       // Fliplet.Hooks.on('repeaterDataRetrieved', function(options) {
//       //   debugger;

//       //   if (options.data.length) {
//       //     manageSocialActionDataSource(options.data[0].dataSourceId, options.data.map(el => el.id));
//       //   }
//       // });

//       function manageSocialActionDataSource(dataSourceId, entryId) {
//         return Fliplet.DataSources.get({
//           attributes: ['id', 'name'],
//           where: { appId: Fliplet.Env.get('appId') }
//         })
//           .then(function(dataSources) {
//             var dsExist = dataSources.find(el => el.name === globalSocialActionsDataSource);


//             if (!dsExist) {
//               return Fliplet.DataSources.create({
//                 name: globalSocialActionsDataSource,
//                 appId: Fliplet.Env.get('appId'),
//                 columns: columnsForSocialDataSource,
//                 accessRules: [{ 'type': ['select', 'insert', 'update', 'delete'], 'allow': 'all' }],
//                 definition: {
//                   'views': [
//                     { 'name': 'userBookmarks',
//                       'bundle': true,
//                       'filter': {
//                         'user': {
//                           '$or': [{ 'Device Uuid': 'session.uuid' },
//                             { 'Email': 'session.email' },
//                             { 'Data Source Entry Id': 'session.id' }
//                           ]
//                         }
//                       }
//                     }
//                   ]
//                 }
//               }).then(function(newDataSource) {
//                 setAttributes(dataSourceId, newDataSource.id, entryId);
//                 setActionClickEvent();
//               });
//             }

//             setAttributes(dataSourceId, dsExist.id, entryId);
//             setActionClickEvent();
//           });
//       }

//       function handleSession(session) {
//         // check if the user is connected to a dataSource login
//         if (session.entries.dataSource) {
//           return _.get(session, 'entries.dataSource.data');
//         }

//         // check if the user is connected to a SAML2 login
//         if (session.entries.saml2) {
//           return _.get(session, 'entries.saml2.user');
//         }

//         // check if the user is connected to a Fliplet login
//         if (session.entries.flipletLogin) {
//           return _.get(session, 'entries.flipletLogin');
//         }
//       }

//       function setActionClickEvent() {
//         $('.social-actions').off('click');
//         $('.social-actions').on('click', function() {
//           const $thisClick = $(this);
//           const originalDataSource = $thisClick.data('original-datasource-id');
//           const globalDataSourceId = $thisClick.data('global-datasource-id');
//           const dataSourceEntryId = $thisClick.data('entry-id');

//           return Fliplet.User.getCachedSession().then(function(session) {
//             var user = '';

//             if (session && session.entries) {
//               user = handleSession(session);
//             }

//             return Fliplet.DataSources.connect(globalDataSourceId)
//               .then(function(connection) {
//                 return connection.findOne({
//                   where: {
//                     $and: [
//                       { $or: [
//                         { Email: user ? user.Email : '' },
//                         { 'Device Uuid': deviceUuid }
//                       ]
//                       },
//                       { 'Data Source Id': originalDataSource },
//                       { 'Data Source Entry Id': dataSourceEntryId },
//                       { 'Type': $thisClick.find('.bookmark:visible').length !== 0 ? 'Bookmark' : 'Like' }
//                     ]
//                   }
//                 }).then(function(record) {
//                   if (record) {
//                     return connection.removeById(record.id)
//                       .then(function onRemove() {
//                         if ($thisClick.find('.bookmark:visible').length !== 0) {
//                           $thisClick.find('.bookmark').toggleClass('fa-bookmark fa-bookmark-o');
//                         } else {
//                           $thisClick.find('.like').toggleClass('fa-heart fa-heart-o');
//                           $thisClick.find('.like-count').html(Number($thisClick.find('.like-count').text()) - 1);
//                         }
//                       });
//                   }

//                   return connection.insert({
//                     'Email': user ? user.Email : '',
//                     'Device Uuid': deviceUuid,
//                     'Data Source Id': originalDataSource,
//                     'Data Source Entry Id': dataSourceEntryId,
//                     'Datetime': new Date(),
//                     'Type': $thisClick.find('.bookmark:visible').length !== 0 ? 'Bookmark' : 'Like',
//                   }).then(function() {
//                     if ($thisClick.find('.bookmark:visible').length !== 0) {
//                       $thisClick.find('.bookmark').toggleClass('fa-bookmark fa-bookmark-o');
//                     } else {
//                       $thisClick.find('.like').toggleClass('fa-heart fa-heart-o');
//                       $thisClick.find('.like-count').html(Number($thisClick.find('.like-count').text()) + 1);
//                     }
//                   });
//                 });
//               });
//           });
//         });
//       }

//       function setAttributes(dataSourceId, globalDataSourceId, entryId) {
//         const $el = $(socialActionThis.$el);

//         return Fliplet.User.getCachedSession().then(function(session) {
//           var user = '';

//           if (session && session.entries) {
//             user = handleSession(session);
//           }

//           return Fliplet.DataSources.connect(globalDataSourceId)
//             .then(function(connection) {
//               var where = {
//                 $and: [
//                   { $or: [
//                     { Email: user ? user.Email : '' },
//                     { 'Device Uuid': deviceUuid }
//                   ]
//                   },
//                   { 'Data Source Id': dataSourceId },
//                   { 'Data Source Entry Id': entryId },
//                   { 'Type': selectedOption }
//                 ]
//               };

//               if (Array.isArray(entryId)) { // from list repeater
//                 where['Data Source Entry Id'] = { $in: entryId };
//               }

//               if (selectedOption === 'Bookmark') {
//                 return connection.findOne({
//                   where
//                 }).then(function(record) {
//                   debugger;
//                   $el.find('.like').hide();
//                   $el.find('.bookmark').show();

//                   if (record) {
//                     $el.find('.bookmark')
//                       .addClass('fa-bookmark')
//                       .removeClass('fa-bookmark-o');
//                   }

//                   $el.find('.social-actions')
//                     .attr('data-original-datasource-id', dataSourceId);
//                   $el.find('.social-actions')
//                     .attr('data-global-datasource-id', globalDataSourceId);
//                   $el.find('.social-actions')
//                     .attr('data-entry-id', entryId);
//                 });
//               } else if (selectedOption === 'Like') {
//                 return connection.find({
//                   where,
//                   attributes: ['Email', 'Device Uuid']
//                 }).then(function(records) {
//                   debugger;
//                   $el.find('.like').show();
//                   $el.find('.like-count').show();
//                   $el.find('.like-container').css('display', 'flex');

//                   if (records && records.find(el =>
//                     el.data.Email === (user ? user.Email : '') || el.data['Device Uuid'] === deviceUuid)) {
//                     $el.find('.like')
//                       .addClass('fa-heart')
//                       .removeClass('fa-heart-o');
//                   }

//                   var socialAction = $el.find('.social-actions');

//                   socialAction
//                     .attr('data-original-datasource-id', dataSourceId)
//                     .attr('data-global-datasource-id', globalDataSourceId)
//                     .attr('data-entry-id', entryId);
//                   socialAction.find('.like-count').html(records.length);
//                 });
//               }
//             });
//         });
//       }
//     },
//     views: [
//       {
//         name: 'typeContent',
//         displayName: 'typeContent',
//         placeholder: '<div class="well text-center"></div>'
//       }
//     ]
//   }
// });
// end with views


// working version with separate DS for each table - TODO remove at the end
// Fliplet.Widget.instance({
//   name: 'social-actions',
//   displayName: 'Social actions',
//   render: {
//     template: [
//       '<div class="social-actions">',
//       '<i class="bookmark fa fa-bookmark-o" aria-hidden="true"></i>',
//       '<div class="like-container">',
//       '<span class="like-count">0</span>',
//       '<i class="like fa fa-heart-o" aria-hidden="true"></i>',
//       '</div>',
//       '</div>'
//     ].join(''),
//     ready: async function() {
//       const socialActionThis = this;
//       const selectedOption = this.fields.typeOfSocialFeature;
//       const columnsForSocialDataSource = [
//         'User', 'Data Source Id', 'Data Source Entry Id', 'Datetime'
//       ];

//       // record container from detail page
//       Fliplet.Hooks.on('recordContainerDataRetrieved', function(record) {
//         manageSocialActionDataSource(record.entry.dataSourceId, record.entry.id);
//       });

//       function manageSocialActionDataSource(dataSourceId, entryId) {
//         return Fliplet.DataSources.getById(dataSourceId, {
//           attributes: ['name', 'columns']
//         }).then(function(originalDataSource) {
//           return Fliplet.DataSources.get({ attributes: ['id', 'name'] })
//             .then(function(dataSources) {
//               var dsExist = dataSources.find(el => el.name === `${selectedOption} - ${originalDataSource.name}`);

//               if (!dsExist) {
//                 return Fliplet.DataSources.create({
//                   name: `${selectedOption} - ${originalDataSource.name}`,
//                   appId: Fliplet.Env.get('appId'),
//                   columns: columnsForSocialDataSource
//                 }).then(function(newDataSource) {
//                   setAttributes(dataSourceId, newDataSource.id, entryId);
//                 });
//               }

//               setAttributes(dataSourceId, dsExist.id, entryId);

//               setActionClickEvent(originalDataSource.id);
//             });
//         });
//       }

//       function setActionClickEvent() {
//         $('.social-actions').off('click');
//         $('.social-actions').on('click', function() {
//           const $thisClick = $(this);
//           const originalDataSource = $thisClick.data('original-datasource-id');
//           const socialDataSourceId = $thisClick.data(`${selectedOption.toLowerCase()}-datasource-id`);
//           const dataSourceEntryId = $thisClick.data('entry-id');

//           return Fliplet.User.getCachedSession().then(function(session) {
//             return Fliplet.DataSources.connect(socialDataSourceId)
//               .then(function(connection) {
//                 return connection.findOne({
//                   where: {
//                   // 'User': '', // add from session
//                     'Data Source Id': originalDataSource,
//                     'Data Source Entry Id': dataSourceEntryId
//                   }
//                 }).then(function(record) {
//                   if (record) {
//                     return connection.removeById(record.id)
//                       .then(function onRemove() {
//                         if (selectedOption === 'Bookmark') {
//                           $thisClick.find('.bookmark').toggleClass('fa-bookmark fa-bookmark-o');
//                         } else {
//                           $thisClick.find('.like').toggleClass('fa-heart fa-heart-o');
//                           $thisClick.find('.like-count').html(Number($thisClick.find('.like-count').text()) - 1);
//                         }
//                       });
//                   }

//                   return connection.insert({
//                   // 'User': '', // todo add from session
//                     'Data Source Id': originalDataSource,
//                     'Data Source Entry Id': dataSourceEntryId,
//                     'Datetime': new Date()
//                   }).then(function() {
//                     if (selectedOption === 'Bookmark') {
//                       $thisClick.find('.bookmark').toggleClass('fa-bookmark fa-bookmark-o');
//                     } else {
//                       $thisClick.find('.like').toggleClass('fa-heart fa-heart-o');
//                       $thisClick.find('.like-count').html(Number($thisClick.find('.like-count').text()) + 1);
//                     }
//                   });
//                 });
//               });
//           });
//         });
//       }

//       function setAttributes(dataSourceId, socialDataSourceId, entryId) {
//         const $el = $(socialActionThis.$el);

//         return Fliplet.User.getCachedSession().then(function(session) {
//           return Fliplet.DataSources.connect(socialDataSourceId)
//             .then(function(connection) {
//               if (selectedOption === 'Bookmark') {
//                 return connection.findOne({
//                   where: {
//                     'User': '', // add from session
//                     'Data Source Id': dataSourceId,
//                     'Data Source Entry Id': entryId
//                   }
//                 }).then(function(record) {
//                   $el.find('.like').hide();
//                   $el.find('.bookmark').show();

//                   if (record) {
//                     $el.find('.bookmark')
//                       .addClass('fa-bookmark')
//                       .removeClass('fa-bookmark-o');
//                   }

//                   $el.find('.social-actions')
//                     .attr('data-original-datasource-id', dataSourceId);
//                   $el.find('.social-actions')
//                     .attr(`data-${selectedOption.toLowerCase()}-datasource-id`, socialDataSourceId);
//                   $el.find('.social-actions')
//                     .attr('data-entry-id', entryId);
//                 });
//               } else if (selectedOption === 'Like') {
//                 return connection.find({
//                   where: {
//                   // 'User': '', // add from session
//                     'Data Source Id': dataSourceId,
//                     'Data Source Entry Id': entryId
//                   },
//                   attributes: ['User']
//                 }).then(function(records) {
//                   $el.find('.like').show();
//                   $el.find('.like-count').show();
//                   $el.find('.like-container').css('display', 'flex');

//                   if (records && records.find(el =>
//                     el.data.User === 'todo session')) {
//                     $el.find('.like')
//                       .addClass('fa-heart')
//                       .removeClass('fa-heart-o');
//                   }

//                   var socialAction = $el.find('.social-actions');

//                   socialAction
//                     .attr('data-original-datasource-id', dataSourceId)
//                     .attr(`data-${selectedOption.toLowerCase()}-datasource-id`, socialDataSourceId)
//                     .attr('data-entry-id', entryId)
//                     .html(records.length);
//                 });
//               }
//             });
//         });
//       }
//     },
//     views: [
//       {
//         name: 'typeContent',
//         displayName: 'typeContent',
//         placeholder: '<div class="well text-center"></div>'
//       }
//     ]
//   }
// });
