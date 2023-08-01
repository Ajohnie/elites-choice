# HANDLEBAR templates - https://handlebarsjs.com
# copy and paste these templates in firestore collection templates or whichever your using
# collection set up is {name:'name of collection', html:'code copied from template'}
# the name of the collection is what you pass to mail object under mail collection or whichever your using;
# remember to compress the html before doing that
mail object:
{
    to: email,
    template: {
      name: emailTemplateName,
      data: { data:"data for the template to use"},
    },
} 
