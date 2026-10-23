import {Component} from 'react';
export default class AppErrorBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main role="alert" style={{padding:40,maxWidth:600,margin:'auto',fontFamily:'Arial'}}><h1>Something didn’t load correctly.</h1><p>Your saved website and business records have not been changed. Reload this page to try again.</p><button type="button" onClick={()=>window.location.reload()}>Reload GETCYB</button></main>:this.props.children;}
}
