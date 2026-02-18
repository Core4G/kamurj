export default {
  async afterCreate(event) {
    const { result } = event;
    
    if (!result.publishedAt) return;

    const to = process.env.NOTIFY_EMAIL; 

    try {
      await strapi.plugin('email').service('email').send({
        to,
        subject: `New feedback (${result.type})`,
        text:
          `
            <b>Name:</b> ${result.name} ${result.surname}<br/>
            <b>Phone:</b> ${result.phoneNumber}<br/>
            <b>Type:</b> ${result.type}<br/><br/>
            <b>Message:</b><br/>
            ${result.message ?? ''}
        `,
      });
    } catch (err) {
      strapi.log.error('Email send failed', err);
    }
  },
};
