import React, { useContext } from "react"
import { AudioContext } from "../context/AudioContext"
import styles from './GlobalAudioControl.module.css'

export default function GlobalAudioControl() {
  const {isMute, enableAudio, disableAudio} = useContext(AudioContext)

  return (
    <div className={styles.container}>
      <button 
        className={`${styles.audioButton} ${isMute ? styles.muted : styles.unmuted}`}
        onClick={() => {
          if (isMute) enableAudio()
          else disableAudio()
        }}
      >
        {isMute ? "🔇" : "🔊"}
      </button>
    </div>
  )
} 