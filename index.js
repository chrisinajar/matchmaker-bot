require("@babel/register")(require("./babel.config"));

require("dotenv").config();

require("./src").default();
