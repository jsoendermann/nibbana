import React, { Component } from 'react'
import { StyleSheet, View, Button, Platform, Dimensions, AsyncStorage, Text } from 'react-native'
import nibbana from 'nibbana'

// TODO(jan): Super parameters

export default class NibbanaExample extends Component {
  componentDidMount() {
    nibbana.configure({
      uploadEntries: entries => console.log('uploadEntries called with: ', entries),
    })
  }
  render() {
    return (
      <View style={styles.container}>
        <Text style={{ fontSize: 13, textAlign: 'center', color: 'red', marginHorizontal: 20 }}>
          Open your debug console to see stuff happening.
        </Text>
        <View style={styles.createContainer}>
          <Button title="Log" onPress={() => nibbana.log(`Log message logged at ${new Date()}`)} />
          <Button title="Debug" onPress={() => nibbana.debug(['Debug message', 1, 2, 3])} />
          <Button title="Warn" onPress={() => nibbana.debug({ foo: 'bar' })} />
          <Button
            title="Error"
            onPress={() => {
              const error = new TypeError('My error message')
              nibbana.error(error)
            }}
          />
        </View>
        <Button
          title="Show AsyncStorage contents"
          onPress={async () => {
            const str = await AsyncStorage.getItem(nibbana.ASYNC_STORAGE_KEY)

            if (!str) {
              console.log('No entries saved in AsyncStorage')
              return
            }
            const obj = JSON.parse(str)
            console.log('nibbana log entries currently saved in AsyncStorage: ', obj)
          }}
        />
        <View>
          <Text style={{ fontSize: 13, textAlign: 'center', color: '#999', marginHorizontal: 20 }}>
            This does nothing if there are no entries in AsyncStorage.
          </Text>
          <Button title="Fake upload now" onPress={nibbana.uploadNow} />
        </View>
        <View>
          <Text style={{ fontSize: 13, textAlign: 'center', color: '#999', marginHorizontal: 20 }}>
            Tap 'Log' a few times after starting automatic uploads to see it in action.
          </Text>
          <Button
            style={{ marginBottom: 20 }}
            title="Start 1s upload interval"
            onPress={() => nibbana.startAutomaticUploads(1)}
          />
          <Button title="Stop upload interval" onPress={nibbana.stopAutomaticUploads} />
        </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    marginTop: Platform.OS === 'ios' ? 20 : 0,
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FCFCFC',
  },
  createContainer: {
    width: Dimensions.get('window').width,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
})
