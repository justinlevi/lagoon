import { ApolloServer } from 'apollo-server';
import { resolvers } from "./resolvers";
import { typeDefs } from "./schema";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  // playground: { version: `1.7.27` }
});

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});