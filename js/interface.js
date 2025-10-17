Fliplet.Widget.findParents().then(async(widgets) => {
  const findParentDataWidget = async(packageName, parents) => {
    const parent = parents.find((parent) => parent.package === packageName);

    if (!parent) {
      return [null];
    }

    return [parent];
  };

  const [[ dynamicContainer ], [ recordContainer ], [ listRepeater ]] = await Promise.all([
    findParentDataWidget('com.fliplet.dynamic-container', widgets),
    findParentDataWidget('com.fliplet.record-container', widgets),
    findParentDataWidget('com.fliplet.list-repeater', widgets)
  ]);

  if (!dynamicContainer || !dynamicContainer.dataSourceId) {
    return Fliplet.Widget.generateInterface({
      title: 'Data interactive icon',
      fields: [
        {
          type: 'html',
          html: '<p style="color: #A5A5A5; font-size: 12px; font-weight: 400;">This component needs to be placed inside a Data container with selected Data source</p>'
        }
      ]
    });
  } else if (!recordContainer && !listRepeater) {
    return Fliplet.Widget.generateInterface({
      title: 'Data interactive icon',
      fields: [
        {
          type: 'html',
          html: '<p style="color: #A5A5A5; font-size: 12px; font-weight: 400;">This component needs to be placed inside a Data record or Data list component</p>'
        }
      ]
    });
  }

  return Fliplet.Widget.generateInterface({
    title: 'Data interactive icon',
    fields: [
      {
        name: 'typeOfSocialFeature',
        type: 'radio',
        label: 'Select type for social feature',
        options: ['Bookmark', 'Like']
      }
    ]
  });
});
