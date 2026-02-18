export default {
  async afterCreate(event) {
    const { result } = event;
    
    if (!result.publishedAt) return;

    const to = process.env.NOTIFY_EMAIL; 

    try {
      await strapi.plugin('email').service('email').send({
        to,
        subject: `New loan application`,
        text:
          `
            <b>Name:</b> ${result.name} ${result.surname}<br/>
            <b>Phone:</b> ${result.phoneNumber}<br/>
            <b>Email:</b> ${result.email}<br/><br/>
        `,
      });
    } catch (err) {
      strapi.log.error('Email send failed', err);
    }
  },
};
