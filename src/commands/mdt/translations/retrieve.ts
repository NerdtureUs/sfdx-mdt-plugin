import { flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import * as chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as he from "he";
import { j2xParser } from "fast-xml-parser";

import { substringBefore } from "../../../utils/utilities";

import { j2xOptions } from "../../../config/fastXMLOptions";

j2xOptions.tagValueProcessor = (a) => he.escape(a);
export default class Retriever extends SfdxCommand {
  public static examples = [
    `$ sfdx mdt:translations:retrieve -u {sourceOrg} -p {sourcepath} [-d {outputdirectory}]
  Retrieve all translations related to a given language
  `,
  ];

  protected static flagsConfig = {
    sourcepath: flags.string({
      char: "p",
      description: "The path to the source metadata translation file",
    }),
    outputdir: flags.string({
      char: "d",
      description:
        "The input directory that stores the decomposed metadata files",
    }),
  };

  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {
    this.ux.startSpinner(chalk.yellowBright("Retrieving Translations"));

    try {
      await this.retrieve(this.flags.sourcepath, this.flags.outputdir);
    } catch (e) {
      // output error
      this.ux.stopSpinner("❌");
      this.ux.error(chalk.redBright(e));
    }

    this.ux.stopSpinner("✔️");

    // Return an object to be displayed with --json
    return { success: true };
  }

  public async retrieve(sourcepath, outputdir) {
    const json2xmlParser = new j2xParser(j2xOptions);
    const conn = this.org.getConnection();
    const languageCode = substringBefore(path.basename(sourcepath), ".");
    const destpath = outputdir
      ? `${outputdir}/${languageCode}.translation-meta.xml`
      : sourcepath;

    // read translations from org
    const translationsJSON = await conn.metadata.readSync("Translations", [
      languageCode,
    ]);

    await fs.writeFileSync(`trads.json`, JSON.stringify(translationsJSON), {
      encoding: "utf8",
    });

    let formattedXml = json2xmlParser.parse({
      Translations: {
        "@": {
          xmlns: "http://soap.sforce.com/2006/04/metadata",
        },
        ...translationsJSON,
      },
    });

    // write xml version & encoding
    await fs.writeFileSync(
      `${destpath}`,
      '<?xml version="1.0" encoding="UTF-8"?>\n',
      {
        encoding: "utf8",
      }
    );

    // write xml file
    await fs.writeFileSync(`${destpath}`, formattedXml, {
      encoding: "utf8",
      flag: "a",
    });
  }
}
