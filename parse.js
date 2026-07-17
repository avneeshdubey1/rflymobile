const fs = require('fs');
fetch('https://docs.google.com/forms/d/e/1FAIpQLSe2VrJNJ3BH2hy3Z6ozWbLSk11tuN3pxMlj4aE0CU66h5RjeQ/viewform')
  .then(res => res.text())
  .then(html => {
    const match = html.match(/var FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      const items = data[1][1];
      items.forEach(item => {
        if (item[1]) {
          let title = item[1];
          let options = [];
          if (item[4] && item[4][0] && item[4][0][1]) {
             options = item[4][0][1].map(opt => opt[0]);
          }
          console.log(`- ${title}`);
          if (options.length > 0) {
            console.log(`  Options: ${options.join(', ')}`);
          }
        }
      });
    } else {
      console.log('No FB_PUBLIC_LOAD_DATA_ found');
    }
  });
