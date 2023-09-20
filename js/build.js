Fliplet.Widget.instance({
  name: 'social-actions',
  displayName: 'Social actions',
  render: {
    template: [
      '<div class="social-actions">',
      // '<div class="swiper-wrapper" data-view="typeContent">',
      '<i class="bookmark fa fa-bookmark" aria-hidden="true"></i>',
      '<i class="bookmark fa fa-bookmark-o" aria-hidden="true"></i>',
      '<i class="like fa fa-heart" aria-hidden="true"></i>',
      '<i class="like fa fa-heart-o" aria-hidden="true"></i>',
      // '</div>',
      '</div>'
    ].join(''),
    ready: async function () {
      const thisy = this;
      const selectedOption = this.fields.typeOfSocialFeature;
      const columnsForSocialDataSource = ['User', 'Data Source Id', 'Data Source Entry Id', 'Datetime']

      Fliplet.Hooks.on('recordContainerDataRetrieved', function (record) {
        manageSocialActionDataSource(record.entry.dataSourceId, record.entry.id)
      });

      function manageSocialActionDataSource(dataSourceId, entryId) {
        return Fliplet.DataSources.getById(dataSourceId, {
          attributes: ['name', 'columns']
        }).then(function (originalDataSource) {
          return Fliplet.DataSources.get({ attributes: ['id', 'name'] }).then(function (dataSources) {
            var dsExist = dataSources.find(el => el.name == `${selectedOption} - ${originalDataSource.name}`)
            if (!dsExist) {
              return Fliplet.DataSources.create({
                name: `${selectedOption} - ${originalDataSource.name}`,
                appId: Fliplet.Env.get('appId'),
                columns: columnsForSocialDataSource,
              }).then(function (newDataSource) {
                setAttributes(dataSourceId, newDataSource.id, entryId)
              });
            } else {
              setAttributes(dataSourceId, dsExist.id, entryId)
            }
            setActionClickEvent(originalDataSource.id);
          });
        });
      }

      function setActionClickEvent(originalDataSource) {
        $('.social-actions').off('click');
        $('.social-actions').on('click', function () {
          const $thisClick = $(this);
          const originalDataSource = $(this).data('original-datasource-id');
          const socialDataSourceId = $(this).data(`${selectedOption.toLowerCase()}-datasource-id`);
          const dataSourceEntryId = $(this).data(`entry-id`);
          return Fliplet.User.getCachedSession().then(function (session) {
            return Fliplet.DataSources.connect(socialDataSourceId).then(function (connection) {
              return connection.findOne({
                where: {
                  'User': '', // add from session
                  'Data Source Id': originalDataSource,
                  'Data Source Entry Id': dataSourceEntryId
                }
              }).then(function (record) {
                if (record) {
                  return connection.removeById(record.id).then(function onRemove() {
                    $thisClick.find('.bookmark').toggleClass('fa-bookmark fa-bookmark-o');
                  });
                } else {
                  return connection.insert({
                    'User': '', // todo add from session
                    'Data Source Id': originalDataSource,
                    'Data Source Entry Id': dataSourceEntryId,
                    'Datetime': new Date()
                  }).then(function onRemove() {
                    $thisClick.find('.bookmark').toggleClass('fa-bookmark fa-bookmark-o');
                  });
                }
              })
            })
          });
        })
      }

      function setAttributes(dataSourceId, socialDataSourceId, entryId) {
        debugger
        $('.social-actions').attr('data-original-datasource-id', dataSourceId);
        $('.social-actions').attr(`data-${selectedOption.toLowerCase()}-datasource-id`, socialDataSourceId);
        $('.social-actions').attr(`data-entry-id`, entryId);
      }
    },
    views: [
      {
        name: 'typeContent',
        displayName: 'typeContent',
        placeholder: '<div class="well text-center">Icon here</div>',
      }
    ]
  }
});