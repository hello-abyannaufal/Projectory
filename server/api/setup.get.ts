export default defineEventHandler(async () => ({
  needsSetup: !(await hasUser())
}))
