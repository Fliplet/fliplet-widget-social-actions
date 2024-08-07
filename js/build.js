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
    data: {
      dataSourceLfdId: null
    },
    ready: async function() {
      const socialAction = this;
      const entry = socialAction?.parent?.entry || {};
      const socialActionInstanceId = socialAction.id;

      function errorMessageStructureNotValid($element, message) {
        $element.addClass('component-error-before');
        Fliplet.UI.Toast(message);
      }

      return Fliplet.Widget.findParents({ instanceId: socialActionInstanceId }).then(widgets => {
        let dynamicContainer = null;
        let recordContainer = null;
        let listRepeater = null;

        widgets.forEach(widget => {
          if (widget.package === 'com.fliplet.dynamic-container') {
            dynamicContainer = widget;
          } else if (widget.package === 'com.fliplet.record-container') {
            recordContainer = widget;
          } else if (widget.package === 'com.fliplet.list-repeater') {
            listRepeater = widget;
          }
        });

        if (!dynamicContainer || !dynamicContainer.dataSourceId || (!recordContainer && !listRepeater)) {
          if (!dynamicContainer || !dynamicContainer.dataSourceId) {
            return errorMessageStructureNotValid($(socialAction.$el), 'This component needs to be placed inside a Dynamic Container and select a data source');
          }

          return errorMessageStructureNotValid($(socialAction.$el), 'This component needs to be placed inside a Record container or List Repeater component');
        }

        socialAction.dataSourceLfdId = dynamicContainer.dataSourceId;
        socialAction.fields = _.assign(
          {
            typeOfSocialFeature: 'Bookmark',
            socialDataSourceId: null,
            iconSize: 'small'
          },
          socialAction.fields
        );

        const deviceUuid = Fliplet.Profile.getDeviceUuid().uuid;
        const selectedOption = socialAction.fields.typeOfSocialFeature;

        // TODO - it is not optimized at all to call get and create every time
        // TODO - Eng should create a solution to create this DS on every app creation?
        // TODO - It might be better to be hidden from the user

        setAttributes(socialAction.dataSourceLfdId, socialAction.fields.socialDataSourceId, entry.id);
        setActionClickEvent();

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
          $(document).off('click', '.social-actions').on('click', '.social-actions', function(e) {
            e.stopPropagation();

            const $thisClick = $(this);
            const entryDataSource = $thisClick.data('original-datasource-id');
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
                    'Data Source Id': entryDataSource,
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
                      'Data Source Id': entryDataSource,
                      'Data Source Entry Id': dataSourceEntryId,
                      'DateTime': new Date().toISOString(),
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

        function setAttributes(dataSourceId, globalSocialActionsDSId, entryId) {
          const $el = $(socialAction.$el);
          let $currentSocialAction = $el.find('.social-actions');

          if (Fliplet.Env.get('mode') === 'interact') {
            $currentSocialAction.addClass('editMode');
          }

          $currentSocialAction.addClass(socialAction.fields.iconSize);

          return Fliplet.User.getCachedSession().then(function(session) {
            let user = '';

            if (session && session.entries) {
              user = handleSession(session);
            }

            return Fliplet.DataSources.connect(globalSocialActionsDSId)
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

                    $currentSocialAction.attr('data-original-datasource-id', dataSourceId);
                    $currentSocialAction.attr('data-global-datasource-id', globalSocialActionsDSId);
                    $currentSocialAction.attr('data-entry-id', entryId);
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

                    $currentSocialAction
                      .attr('data-original-datasource-id', dataSourceId)
                      .attr('data-global-datasource-id', globalSocialActionsDSId)
                      .attr('data-entry-id', entryId);
                    $currentSocialAction.find('.like-count').html(records.length);
                  });
                }
              });
          });
        }
      });
    },
    views: [
      {
        name: 'content',
        displayName: 'Social action content',
        placeholder: '<p>Configure Social action component</p>'
      }
    ]
  }
});
