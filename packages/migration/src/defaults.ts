import { v1v2 } from "./migrations"
import { Migrations } from "./migrator"

export const DefaultMigrations: Migrations = {
  2: new v1v2.Migration_v1v2()
}
