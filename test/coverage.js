after(async () => {
  if (process.env.TEST_COVERAGE) {
    console.log('Writing coverage report.')
    await global.coverageSubprovider.writeCoverageAsync()
  }
})
