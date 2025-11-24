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
       * Finds and returns the parent widget and its entry data for a specified widget type.
       * @param {string} type - The type of parent widget to search for
       * @param {string} packageName - The widget package name to match
       * @returns {Promise<Array>} Promise resolving to [parentConfig|null, parentInstance|null]
       * @async
       * @private
       */
      const findParentDataWidget = async(type, packageName) => {
        const parent = parents.find((parent) => parent.package === packageName);

        if (!parent) {
          return [null, null];
        }

        const instance = await Fliplet[type].get({ id: parent.id });

        return [parent, instance];
      };

      const [[ dynamicContainer ], [ recordContainer, recordContainerInstance ], [ listRepeater, listRepeaterInstance ]] = await Promise.all([
        findParentDataWidget('DynamicContainer', 'com.fliplet.dynamic-container'),
        findParentDataWidget('RecordContainer', 'com.fliplet.record-container'),
        findParentDataWidget('ListRepeater', 'com.fliplet.list-repeater')
      ]);

      if (!dynamicContainer || !dynamicContainer.dataSourceId) {
        return Fliplet.UI.Toast('This component needs to be placed inside a Data container and select a data source');
      }

      if (!recordContainer && !listRepeater) {
        return Fliplet.UI.Toast('This component needs to be placed inside a Data record or Data list component');
      }

      let ENTRY = null;

      if (recordContainerInstance) {
        ENTRY = recordContainerInstance.entry;
      } else if (listRepeaterInstance) {
        const closestListRepeaterRow = socialAction.parents().find(parent => parent.element.nodeName.toLowerCase() === 'fl-list-repeater-row');

        if (closestListRepeaterRow) {
          ENTRY = closestListRepeaterRow.entry;
        }
      }

      if (!ENTRY) {
        const selectedOption = socialAction.fields.typeOfSocialFeature;
        const $el = $(socialAction.$el);

        if (selectedOption === 'Bookmark') {
          $el.find('.like').hide();
          $el.find('.bookmark').show();
        } else if (selectedOption === 'Like') {
          $el.find('.bookmark').hide();
          $el.find('.like').show();
          $el.find('.like-count').show();
          $el.find('.like-container').css('display', 'flex');
        }

        return;
      }

      const entry = ENTRY;

      socialAction.dataSourceLfdId = dynamicContainer.dataSourceId;

      const deviceUuid = Fliplet.Profile.getDeviceUuid().uuid;

      socialAction.fields = _.assign(
        {
          typeOfSocialFeature: undefined
        },
        socialAction.fields
      );

      const selectedOption = socialAction.fields.typeOfSocialFeature;

      // Ensure the correct icon is shown immediately to avoid late appearance
      const $initialEl = $(socialAction.$el);

      if (selectedOption === 'Bookmark') {
        $initialEl.find('.like').hide();
        $initialEl.find('.bookmark').show();
      } else if (selectedOption === 'Like') {
        $initialEl.find('.bookmark').hide();
        $initialEl.find('.like').show();
        $initialEl.find('.like-count').show();
        $initialEl.find('.like-container').css('display', 'flex');
      }

      // If parent data is already available, initialize checked state and counts immediately
      (function eagerInitializeIfPossible() {
        const parentInstance = recordContainerInstance || listRepeaterInstance;

        if (!parentInstance) {
          return;
        }

        const hasGlobalData = parentInstance.globalSocialActionsDS && parentInstance.globalSocialActionsDSId;

        if (!hasGlobalData) {
          return;
        }

        const globalSocialActionsDSData = parentInstance.globalSocialActionsDS || [];
        const globalSocialActionsDSId = parentInstance.globalSocialActionsDSId;
        const cachedSessionData = parentInstance.cachedSessionData;

        setAttributes(socialAction.dataSourceLfdId, globalSocialActionsDSData, entry.id, globalSocialActionsDSId, cachedSessionData);
        setActionClickEvent(cachedSessionData);
      })();

      await manageSocialActionDataSource(socialAction.dataSourceLfdId, entry.id);

      // TODO - Fliplet.DataSources.get and Fliplet.DataSources.create might be sufficient
      // TODO - it is not optimized at all to call get and create every time
      // TODO - Eng should create a solution to create this DS on every app creation?
      // TODO - It might be better to be hidden from the user
      /**
       * Polls until the provided condition returns a truthy value or a timeout elapses
       * @param {Function} conditionFn - Function returning a truthy value when ready
       * @param {Object} options - Configuration options
       * @param {number} options.intervalMs - Interval between checks in milliseconds
       * @param {number} options.timeoutMs - Maximum time to wait in milliseconds
       * @returns {Promise<*>} Resolves with the condition result or null on timeout
       * @private
       */
      function waitFor(conditionFn, options) {
        const opts = options || {};
        const intervalMs = typeof opts.intervalMs === 'number' ? opts.intervalMs : 100;
        const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 5000;

        return new Promise(function(resolve) {
          const start = Date.now();

          function check() {
            let result;

            try {
              result = conditionFn();
            } catch (e) {
              // Ignore errors during evaluation and keep polling
            }

            if (result) {
              return resolve(result);
            }

            if (Date.now() - start >= timeoutMs) {
              return resolve(null);
            }

            setTimeout(check, intervalMs);
          }

          check();
        });
      }

      /**
       * Ensures the parent widget data is available before initializing attributes and click handlers.
       * Falls back after a timeout to avoid excessive delays in UI rendering.
       * @param {number|string} dataSourceId - Original data source id
       * @param {number|string} entryId - Entry id within the original data source
       * @returns {Promise<void>} Resolves when the component has initialized its attributes and events
       * @private
       */
      async function manageSocialActionDataSource(dataSourceId, entryId) {
        // Wait until the parent exposes the required data
        await waitFor(function() {
          const parentInstance = recordContainerInstance || listRepeaterInstance;

          return parentInstance && parentInstance.globalSocialActionsDS && parentInstance.globalSocialActionsDSId;
        }, { intervalMs: 100, timeoutMs: 5000 });

        const parentInstance = recordContainerInstance || listRepeaterInstance;
        const globalSocialActionsDSData = parentInstance && parentInstance.globalSocialActionsDS ? parentInstance.globalSocialActionsDS : [];
        const globalSocialActionsDSId = parentInstance && parentInstance.globalSocialActionsDSId ? parentInstance.globalSocialActionsDSId : undefined;
        const cachedSessionData = parentInstance && parentInstance.cachedSessionData ? parentInstance.cachedSessionData : undefined;

        setAttributes(dataSourceId, globalSocialActionsDSData, entryId, globalSocialActionsDSId, cachedSessionData);
        setActionClickEvent(cachedSessionData);
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

      function setActionClickEvent(cachedSessionData) {
        $(socialAction.$el).find('.social-actions').off('click').on('click', function() {
          const $thisClick = $(this);
          const originalDataSource = $thisClick.data('original-datasource-id');
          const globalDataSourceId = $thisClick.data('global-datasource-id');
          const dataSourceEntryId = $thisClick.data('entry-id');
          const normalizedEntryId = (dataSourceEntryId !== null && dataSourceEntryId !== undefined && dataSourceEntryId !== '')
            ? String(dataSourceEntryId)
            : undefined;

          // Guard against clicks before attributes are set (e.g. when navigating quickly between pages)
          if (!globalDataSourceId || !originalDataSource || !normalizedEntryId) {
            Fliplet.UI.Toast('Still loading… Please try again.');

            return;
          }

          // Prevent concurrent requests when users tap repeatedly
          if ($thisClick.data('busy')) {
            return;
          }

          $thisClick.data('busy', true);


          let user = '';

          if (cachedSessionData && cachedSessionData.entries) {
            user = handleSession(cachedSessionData);
          }

          return Fliplet.DataSources.connect(globalDataSourceId)
            .then(function(connection) {
              let where = {
                'Data Source Id': originalDataSource,
                'Data Source Entry Id': normalizedEntryId,
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
                    })
                    .catch(function(err) {
                      // Be tolerant to 404/entry not found during races or cross-device states
                      if ((err && err.response && err.response.data && err.response.data.message) !== 'The requested Data Source entry has not been found.') {
                        throw err;
                      }
                    });
                }

                return connection.insert({
                  'Email': user ? user.Email : '',
                  'Device Uuid': deviceUuid,
                  'Data Source Id': originalDataSource,
                  'Data Source Entry Id': normalizedEntryId,
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
            })
            .catch(function() {
              // Surface unexpected errors
              Fliplet.UI.Toast('Something went wrong. Please try again.');
            })
            .finally(function() {
              $thisClick.data('busy', false);
            });
        });
      }

      function setAttributes(dataSourceId, globalSocialActionsDSData, entryId, globalSocialActionsDSId, cachedSessionData) {
        const $el = $(socialAction.$el);

        let user = '';

        if (cachedSessionData && cachedSessionData.entries) {
          user = handleSession(cachedSessionData);
        }

        const filteredGlobalSocialActionsDSData = globalSocialActionsDSData && globalSocialActionsDSData.filter((row) => {
          const rowData = row.data || {};
          const userEmail = user ? user.Email : '';

          return rowData['Data Source Id'] === dataSourceId &&
            String(rowData['Data Source Entry Id']) === String(entryId) &&
            rowData['Type'] === selectedOption &&
            (rowData['Email'] === userEmail || rowData['Device Uuid'] === deviceUuid);
        });

        if (selectedOption === 'Bookmark') {
          $el.find('.like').hide();
          $el.find('.bookmark').show();

          if (filteredGlobalSocialActionsDSData && filteredGlobalSocialActionsDSData.length) {
            $el.find('.bookmark')
              .addClass('fa-bookmark')
              .removeClass('fa-bookmark-o');
          }

          $el.find('.social-actions')
            .attr('data-original-datasource-id', dataSourceId);
          $el.find('.social-actions')
            .attr('data-global-datasource-id', globalSocialActionsDSId);
          $el.find('.social-actions')
            .attr('data-entry-id', entryId);
        } else if (selectedOption === 'Like') {
          $el.find('.like').show();
          $el.find('.like-count').show();
          $el.find('.like-container').css('display', 'flex');

          if (filteredGlobalSocialActionsDSData && filteredGlobalSocialActionsDSData.find(el =>
            el.data.Email === (user ? user.Email : '') || el.data['Device Uuid'] === deviceUuid)) {
            $el.find('.like')
              .addClass('fa-heart')
              .removeClass('fa-heart-o');
          }

          let currentSocialAction = $el.find('.social-actions');

          currentSocialAction
            .attr('data-original-datasource-id', dataSourceId)
            .attr('data-global-datasource-id', globalSocialActionsDSId)
            .attr('data-entry-id', entryId);
          currentSocialAction.find('.like-count').html(filteredGlobalSocialActionsDSData && filteredGlobalSocialActionsDSData.length);
        }
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
