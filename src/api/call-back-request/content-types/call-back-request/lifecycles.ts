export default {
  async afterCreate(event) {
    const { result } = event;
    
    if (!result.publishedAt) return;

    const to = process.env.NOTIFY_EMAIL; 

    try {
      await strapi.plugin('email').service('email').send({
        to,
        subject: `New call back request`,
        text:
          `
            <b>Phone Number:</b> ${result.PhoneNumber}<br/>
        `,
      });
    } catch (err) {
      strapi.log.error('Email send failed', err);
    }
  },
};
