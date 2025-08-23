export const recordPrefixesApexScript = `List<EntityDefinition> defs = new List<EntityDefinition>();
String lastApiName = '';
Boolean moreDefs = addMoreDefs(defs, lastApiName);
while (moreDefs) {
    lastApiName = defs[defs.size() - 1].QualifiedApiName;
    moreDefs = addMoreDefs(defs, lastApiName);
}

for (EntityDefinition entityDefinition : defs) {
    System.debug(entityDefinition.QualifiedApiName + ',' + entityDefinition.KeyPrefix);
}

private static Boolean addMoreDefs(List<EntityDefinition> defs, String lastApiName) {
    List<EntityDefinition> newDefs = [SELECT QualifiedApiName, KeyPrefix FROM EntityDefinition
                                        WHERE QualifiedApiName > :lastApiName ORDER BY QualifiedApiName ASC LIMIT 2000];
    defs.addAll(newDefs);
    return newDefs.size() == 2000;
}`;
